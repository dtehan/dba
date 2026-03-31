"""Agent runner for Gemini — adapted for google-genai SDK.

Non-streaming version for eval use. Calls Gemini API with system prompt,
messages, and tools, then dispatches tool calls to a mock executor.
"""

from __future__ import annotations

from typing import Any

from google import genai
from google.genai import types

from harness.agent_runner import ConversationResult, ToolCall, ToolExecutor


def _convert_tools_to_gemini(tools: list[dict]) -> list[types.Tool] | None:
    """Convert Anthropic-format tool definitions to Gemini function declarations."""
    if not tools:
        return None

    declarations = []
    for tool in tools:
        schema = tool.get("input_schema", {})
        decl: dict[str, Any] = {
            "name": tool["name"],
            "description": tool.get("description", ""),
        }
        if schema.get("properties"):
            decl["parameters"] = _convert_schema(schema)
        declarations.append(decl)

    return [types.Tool(function_declarations=declarations)]


def _convert_schema(schema: dict) -> dict:
    """Convert JSON Schema to Gemini-compatible schema dict."""
    result: dict[str, Any] = {"type": schema.get("type", "OBJECT").upper()}

    if schema.get("description"):
        result["description"] = schema["description"]

    if schema.get("enum"):
        result["enum"] = schema["enum"]

    if schema.get("properties"):
        result["properties"] = {
            k: _convert_schema(v) for k, v in schema["properties"].items()
        }

    if schema.get("required"):
        result["required"] = schema["required"]

    if schema.get("items"):
        result["items"] = _convert_schema(schema["items"])

    return result


def _convert_messages_to_contents(
    messages: list[dict[str, Any]],
) -> list[types.Content]:
    """Convert Anthropic-style messages to Gemini Content objects."""
    contents = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        content_val = msg.get("content", "")

        if isinstance(content_val, str):
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=content_val)],
                )
            )
        elif isinstance(content_val, list):
            parts = []
            for block in content_val:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        parts.append(types.Part.from_text(text=block.get("text", "")))
                    elif block.get("type") == "tool_use":
                        parts.append(
                            types.Part.from_function_call(
                                name=block["name"],
                                args=block.get("input", {}),
                            )
                        )
                    elif block.get("type") == "tool_result":
                        parts.append(
                            types.Part.from_function_response(
                                name=block.get("tool_name", "unknown"),
                                response={"result": block.get("content", "")},
                            )
                        )
            if parts:
                contents.append(types.Content(role=role, parts=parts))

    return contents


def run_gemini_agent_loop(
    client: genai.Client,
    model_id: str,
    system_prompt: str,
    messages: list[dict[str, Any]],
    tools: list[dict],
    tool_executor: ToolExecutor,
    max_rounds: int = 10,
    max_tokens: int = 4096,
) -> ConversationResult:
    """Run the agent loop using Gemini: send messages, handle tool calls, repeat."""
    gemini_tools = _convert_tools_to_gemini(tools)
    contents = _convert_messages_to_contents(messages)
    all_tool_calls: list[ToolCall] = []
    final_text = ""
    last_stop_reason = "end_turn"
    conversation_messages = list(messages)

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=max_tokens,
    )
    if gemini_tools:
        config.tools = gemini_tools

    for round_num in range(max_rounds):
        response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config,
        )

        # Track token usage
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            try:
                from cost_tracker import get_tracker
                get_tracker().record(
                    input_tokens=getattr(response.usage_metadata, "prompt_token_count", 0),
                    output_tokens=getattr(response.usage_metadata, "candidates_token_count", 0),
                    model=model_id,
                    caller="agent",
                )
            except ImportError:
                pass

        # Check for function calls
        function_calls = []
        text_parts = []

        if response.candidates:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    function_calls.append(part.function_call)
                if part.text:
                    text_parts.append(part.text)

        if function_calls:
            # Record assistant response with tool calls in Anthropic format
            assistant_content: list[dict[str, Any]] = []
            if text_parts:
                assistant_content.append({"type": "text", "text": "".join(text_parts)})

            # Build Gemini content parts for the assistant message
            assistant_parts = []
            if text_parts:
                assistant_parts.append(types.Part.from_text(text="".join(text_parts)))

            for i, fc in enumerate(function_calls):
                args = dict(fc.args) if fc.args else {}
                assistant_content.append({
                    "type": "tool_use",
                    "id": f"call_{round_num}_{i}",
                    "name": fc.name,
                    "input": args,
                })
                assistant_parts.append(
                    types.Part.from_function_call(name=fc.name, args=args)
                )

            conversation_messages.append({"role": "assistant", "content": assistant_content})
            contents.append(types.Content(role="model", parts=assistant_parts))

            # Execute tools and build response
            tool_results: list[dict[str, Any]] = []
            response_parts = []

            for i, fc in enumerate(function_calls):
                args = dict(fc.args) if fc.args else {}
                result = tool_executor.execute(fc.name, args)
                all_tool_calls.append(ToolCall(name=fc.name, input=args, output=result))

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": f"call_{round_num}_{i}",
                    "tool_name": fc.name,
                    "content": result,
                })
                response_parts.append(
                    types.Part.from_function_response(
                        name=fc.name,
                        response={"result": result},
                    )
                )

            conversation_messages.append({"role": "user", "content": tool_results})
            contents.append(types.Content(role="user", parts=response_parts))
            last_stop_reason = "tool_use"
            continue

        # No function calls — final text response
        final_text = "".join(text_parts)
        conversation_messages.append({"role": "assistant", "content": final_text})
        last_stop_reason = "end_turn"

        return ConversationResult(
            messages=conversation_messages,
            final_text=final_text,
            tool_calls=all_tool_calls,
            rounds_used=round_num + 1,
            stop_reason=last_stop_reason,
        )

    # Exhausted max rounds
    return ConversationResult(
        messages=conversation_messages,
        final_text=final_text,
        tool_calls=all_tool_calls,
        rounds_used=max_rounds,
        stop_reason=last_stop_reason,
    )
