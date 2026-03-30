"""Agent runner — port of runAgentLoop() from src/main/ipc/chat.ts.

Non-streaming version for eval use. Calls Bedrock API with system prompt,
messages, and tools, then dispatches tool calls to a mock executor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


class ToolExecutor(Protocol):
    """Interface for tool call dispatch (mock or real)."""

    def execute(self, tool_name: str, tool_input: dict) -> str: ...


@dataclass
class ToolCall:
    """Record of a single tool call made during the agent loop."""

    name: str
    input: dict
    output: str


@dataclass
class ConversationResult:
    """Result of running the agent loop to completion."""

    messages: list[dict[str, Any]]
    final_text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    rounds_used: int = 0
    stop_reason: str = "end_turn"


def run_agent_loop(
    client: Any,
    model: str,
    system_prompt: str,
    messages: list[dict[str, Any]],
    tools: list[dict],
    tool_executor: ToolExecutor,
    max_rounds: int = 10,
    max_tokens: int = 4096,
) -> ConversationResult:
    """Run the agent loop: send messages, handle tool calls, repeat.

    Port of runAgentLoop() from chat.ts lines 43-141.
    Uses non-streaming messages.create() for eval efficiency.
    """
    conversation_messages = list(messages)
    all_tool_calls: list[ToolCall] = []
    final_text = ""
    last_stop_reason = "end_turn"

    for round_num in range(max_rounds):
        request_params: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": conversation_messages,
        }
        if tools:
            request_params["tools"] = tools

        response = client.messages.create(**request_params)
        last_stop_reason = response.stop_reason

        # Track token usage for cost reporting
        if hasattr(response, "usage") and response.usage:
            try:
                from cost_tracker import get_tracker
                get_tracker().record(
                    input_tokens=response.usage.input_tokens,
                    output_tokens=response.usage.output_tokens,
                    model=model,
                    caller="agent",
                )
            except ImportError:
                pass

        if response.stop_reason == "tool_use":
            tool_blocks = [b for b in response.content if b.type == "tool_use"]
            if not tool_blocks:
                break

            # Append assistant message with full content (text + tool_use blocks)
            conversation_messages.append(
                {
                    "role": "assistant",
                    "content": [_content_block_to_dict(b) for b in response.content],
                }
            )

            # Execute each tool call and collect results
            tool_results = []
            for block in tool_blocks:
                result = tool_executor.execute(block.name, block.input)
                all_tool_calls.append(
                    ToolCall(name=block.name, input=block.input, output=result)
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    }
                )

            conversation_messages.append({"role": "user", "content": tool_results})
            continue

        # No tool use — extract final text, append to messages, and finish
        text_parts = [b.text for b in response.content if b.type == "text"]
        final_text = "".join(text_parts)
        conversation_messages.append(
            {"role": "assistant", "content": final_text}
        )
        return ConversationResult(
            messages=conversation_messages,
            final_text=final_text,
            tool_calls=all_tool_calls,
            rounds_used=round_num + 1,
            stop_reason=last_stop_reason,
        )

    # Exhausted max rounds — return what we have
    # Try to extract any text from the last response
    return ConversationResult(
        messages=conversation_messages,
        final_text=final_text,
        tool_calls=all_tool_calls,
        rounds_used=max_rounds,
        stop_reason=last_stop_reason,
    )


def _content_block_to_dict(block: Any) -> dict:
    """Convert an Anthropic SDK content block to a plain dict."""
    if block.type == "text":
        return {"type": "text", "text": block.text}
    if block.type == "tool_use":
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    # Fallback
    return {"type": block.type}
