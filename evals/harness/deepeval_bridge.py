"""Bridge between agent_runner results and DeepEval test cases.

Converts ConversationResult objects into DeepEval ConversationalTestCase
objects for metric scoring.
"""

from __future__ import annotations

from typing import Any

from deepeval.test_case import (
    ConversationalTestCase,
    Turn,
    ToolCall as DEToolCall,
)

from harness.agent_runner import ConversationResult, ToolCall


def agent_result_to_test_case(
    result: ConversationResult,
    scenario: dict,
    chatbot_role: str | None = None,
) -> ConversationalTestCase:
    """Convert an agent run result + scenario metadata into a DeepEval test case.

    Parses the conversation messages into Turn objects, attaching tool call
    info where present.
    """
    turns = _messages_to_turns(result.messages, result.tool_calls)

    return ConversationalTestCase(
        turns=turns,
        scenario=scenario.get("scenario", ""),
        chatbot_role=chatbot_role or scenario.get("chatbot_role", ""),
        expected_outcome=scenario.get("expected_outcome", ""),
        context=scenario.get("context", []),
        user_description=scenario.get("user_description", ""),
    )


def scripted_scenario_to_test_case(scenario: dict) -> ConversationalTestCase:
    """Convert a scripted scenario's pre-written turns into a DeepEval test case."""
    turns = []
    for t in scenario["turns"]:
        tools_called = None
        if t.get("tools_called"):
            tools_called = [
                DEToolCall(
                    name=tc["name"],
                    input_parameters=tc.get("input_parameters"),
                    output=tc.get("output"),
                )
                for tc in t["tools_called"]
            ]
        turns.append(
            Turn(
                role=t["role"],
                content=t["content"],
                tools_called=tools_called,
            )
        )

    return ConversationalTestCase(
        turns=turns,
        scenario=scenario.get("scenario", ""),
        chatbot_role=scenario.get("chatbot_role", ""),
        expected_outcome=scenario.get("expected_outcome", ""),
        context=scenario.get("context", []),
        user_description=scenario.get("user_description", ""),
    )


def _messages_to_turns(
    messages: list[dict[str, Any]],
    tool_calls: list[ToolCall],
) -> list[Turn]:
    """Parse Anthropic-style conversation messages into DeepEval Turn objects.

    Maps tool_use blocks in assistant messages to ToolCall objects, and
    extracts text content from both simple string and content-block formats.
    """
    turns: list[Turn] = []
    # Index tool calls by their position for matching
    tool_call_iter = iter(tool_calls)

    for msg in messages:
        role = msg["role"]
        content = msg.get("content", "")

        # Skip tool_result messages (role=user with tool_result content)
        if role == "user" and isinstance(content, list):
            if any(
                isinstance(item, dict) and item.get("type") == "tool_result"
                for item in content
            ):
                continue

        # Extract text content
        if isinstance(content, str):
            text = content
            de_tools = None
        elif isinstance(content, list):
            # Content blocks format
            text_parts = []
            de_tools_list = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        # Match with recorded tool call
                        tc = next(tool_call_iter, None)
                        if tc:
                            de_tools_list.append(
                                DEToolCall(
                                    name=tc.name,
                                    input_parameters=tc.input,
                                    output=tc.output,
                                )
                            )
            text = "".join(text_parts)
            de_tools = de_tools_list if de_tools_list else None
        else:
            text = str(content)
            de_tools = None

        if text or de_tools:
            turns.append(
                Turn(
                    role=role,
                    content=text or "(tool calls only)",
                    tools_called=de_tools,
                )
            )

    return turns
