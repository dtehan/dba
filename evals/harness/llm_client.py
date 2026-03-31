"""Unified LLM client factory for eval harness.

Routes to Bedrock (Claude) or Gemini based on EVAL_PROVIDER env var.
"""

from __future__ import annotations

import os
from typing import Any

from harness.agent_runner import ConversationResult, ToolExecutor


def get_provider() -> str:
    """Get the configured LLM provider. Loads .env if needed."""
    # Load .env for EVAL_PROVIDER and other settings
    try:
        from dotenv import load_dotenv
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass

    return os.environ.get("EVAL_PROVIDER", "bedrock").lower()


def get_client() -> tuple[Any, str, str]:
    """Get the appropriate LLM client based on EVAL_PROVIDER.

    Returns:
        Tuple of (client, model_id, provider_name).
    """
    provider = get_provider()

    if provider == "gemini":
        from harness.gemini_client import get_gemini_client
        model, model_id = get_gemini_client()
        return model, model_id, "gemini"
    else:
        from harness.bedrock_client import get_bedrock_client
        client, model_id = get_bedrock_client()
        return client, model_id, "bedrock"


def run_agent(
    client: Any,
    model_id: str,
    provider: str,
    system_prompt: str,
    messages: list[dict[str, Any]],
    tools: list[dict],
    tool_executor: ToolExecutor,
    max_rounds: int = 10,
    max_tokens: int = 4096,
) -> ConversationResult:
    """Run the agent loop using the appropriate provider."""
    if provider == "gemini":
        from harness.gemini_runner import run_gemini_agent_loop
        return run_gemini_agent_loop(
            client=client,
            model_id=model_id,
            system_prompt=system_prompt,
            messages=messages,
            tools=tools,
            tool_executor=tool_executor,
            max_rounds=max_rounds,
            max_tokens=max_tokens,
        )
    else:
        from harness.agent_runner import run_agent_loop
        return run_agent_loop(
            client=client,
            model=model_id,
            system_prompt=system_prompt,
            messages=messages,
            tools=tools,
            tool_executor=tool_executor,
            max_rounds=max_rounds,
            max_tokens=max_tokens,
        )
