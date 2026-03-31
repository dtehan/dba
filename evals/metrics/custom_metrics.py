"""DeepEval metrics configured for Teradata DBA Agent evaluation.

Provides 7 metrics from the eval spec, using DeepEval's built-in
conversational metrics with domain-specific configuration.

Supports both AWS Bedrock (Claude) and Google Gemini as judge models
based on the EVAL_PROVIDER environment variable.
"""

from __future__ import annotations

import os
from typing import Any

from deepeval.metrics import (
    ConversationalGEval,
    ConversationCompletenessMetric,
    KnowledgeRetentionMetric,
    RoleAdherenceMetric,
    ToolUseMetric,
)
from deepeval.test_case import ToolCall as DEToolCall, TurnParams


def get_judge_model() -> Any:
    """Create a judge model for DeepEval scoring.

    Uses Bedrock or Gemini based on EVAL_PROVIDER env var.
    For Gemini, uses DeepEval's GeminiModel.
    For Bedrock, uses DeepEval's AmazonBedrockModel.
    """
    # Load .env
    try:
        from dotenv import load_dotenv
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass

    provider = os.environ.get("EVAL_PROVIDER", "bedrock").lower()

    if provider == "gemini":
        return _get_gemini_judge()
    return _get_bedrock_judge()


def _get_bedrock_judge() -> Any:
    """Create a Bedrock model for use as an LLM judge."""
    from deepeval.models import AmazonBedrockModel

    region = os.environ.get("AWS_REGION", "us-west-2")
    model_id = os.environ.get(
        "EVAL_JUDGE_MODEL",
        os.environ.get("EVAL_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0"),
    )

    kwargs: dict[str, Any] = {
        "model": model_id,
        "region": region,
    }

    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    session_token = os.environ.get("AWS_SESSION_TOKEN")

    if access_key:
        kwargs["aws_access_key_id"] = access_key
    if secret_key:
        kwargs["aws_secret_access_key"] = secret_key
    if session_token:
        kwargs["aws_session_token"] = session_token

    return AmazonBedrockModel(**kwargs)


def _get_gemini_judge() -> Any:
    """Create a Gemini model for use as an LLM judge.

    DeepEval supports Gemini natively via its GeminiModel class.
    Falls back to a string model identifier via litellm if GeminiModel
    is not available.
    """
    model_id = os.environ.get(
        "EVAL_JUDGE_MODEL",
        os.environ.get("EVAL_GEMINI_MODEL", "gemini-2.5-flash"),
    )

    try:
        from deepeval.models import GeminiModel
        return GeminiModel(model=model_id)
    except (ImportError, AttributeError):
        # Older DeepEval versions may not have GeminiModel
        # Fall back to string model identifier which DeepEval
        # can resolve via litellm
        return f"gemini/{model_id}"


# ---------------------------------------------------------------------------
# Metric factory functions
# ---------------------------------------------------------------------------


def conversation_quality_metric(
    model: Any | None = None,
    threshold: float = 0.7,
) -> ConversationalGEval:
    """Conversation Quality — coherence, accuracy, helpfulness across turns."""
    return ConversationalGEval(
        name="Conversation Quality",
        model=model or get_judge_model(),
        evaluation_params=[
            TurnParams.CONTENT,
            TurnParams.ROLE,
        ],
        criteria=(
            "Evaluate the coherence, accuracy, and helpfulness of the "
            "assistant's responses across the entire conversation in the "
            "context of a Teradata DBA analysis tool."
        ),
        evaluation_steps=[
            "Check if the assistant maintains consistency across turns — no contradictions.",
            "Verify the assistant correctly references information from earlier turns.",
            "Assess whether the assistant builds on prior context rather than repeating information.",
            "Check if the assistant's technical explanations about Teradata are accurate.",
            "Evaluate whether clarifying questions are relevant and well-targeted.",
        ],
        threshold=threshold,
        async_mode=False,
    )


def knowledge_retention_metric(
    model: Any | None = None,
    threshold: float = 0.7,
) -> KnowledgeRetentionMetric:
    """Knowledge Retention — remembers facts stated earlier in conversation."""
    return KnowledgeRetentionMetric(
        model=model or get_judge_model(),
        threshold=threshold,
        async_mode=False,
    )


def conversation_completeness_metric(
    model: Any | None = None,
    threshold: float = 0.7,
) -> ConversationCompletenessMetric:
    """Conversation Completeness — all user intents addressed."""
    return ConversationCompletenessMetric(
        model=model or get_judge_model(),
        threshold=threshold,
        async_mode=False,
    )


def tool_use_metric(
    available_tools: list[dict],
    model: Any | None = None,
    threshold: float = 0.7,
) -> ToolUseMetric:
    """Tool Use Accuracy — right tools called with right arguments.

    Args:
        available_tools: Tool definitions from tools/definitions.py.
            Each dict has name, description, input_schema.
    """
    de_tools = [
        DEToolCall(
            name=t["name"],
            description=t.get("description", ""),
        )
        for t in available_tools
    ]
    return ToolUseMetric(
        available_tools=de_tools,
        model=model or get_judge_model(),
        threshold=threshold,
        async_mode=False,
    )


def role_adherence_metric(
    model: Any | None = None,
    threshold: float = 0.7,
) -> RoleAdherenceMetric:
    """Role Adherence — agent stays in character as defined role."""
    return RoleAdherenceMetric(
        model=model or get_judge_model(),
        threshold=threshold,
        async_mode=False,
    )


def task_completion_metric(
    task: str | None = None,
    model: Any | None = None,
    threshold: float = 0.7,
) -> ConversationalGEval:
    """Task Completion — agent achieved the stated goal.

    Uses ConversationalGEval (not TaskCompletionMetric) because the latter
    only supports LLMTestCase, not ConversationalTestCase.

    Args:
        task: Description of the expected outcome. Embedded in eval criteria.
    """
    task_desc = task or "the task described in the scenario"
    return ConversationalGEval(
        name="Task Completion",
        model=model or get_judge_model(),
        evaluation_params=[
            TurnParams.CONTENT,
            TurnParams.ROLE,
            TurnParams.TOOLS_CALLED,
        ],
        criteria=(
            f"Evaluate whether the assistant successfully completed the "
            f"following task: {task_desc}"
        ),
        evaluation_steps=[
            "Did the assistant address the core objective of the task?",
            "Did the assistant take appropriate action — either using tools to gather information, or correctly delegating to a specialized agent if the task description says delegation IS the goal?",
            "Is the final output complete and well-structured for what was asked?",
            "Does the output match the expected outcome described in the task?",
            "Are the conclusions, recommendations, or suggestions actionable?",
        ],
        threshold=threshold,
        async_mode=False,
    )


def trajectory_efficiency_metric(
    model: Any | None = None,
    threshold: float = 0.6,
) -> ConversationalGEval:
    """Trajectory Efficiency — no unnecessary steps or wasted calls."""
    return ConversationalGEval(
        name="Trajectory Efficiency",
        model=model or get_judge_model(),
        evaluation_params=[
            TurnParams.CONTENT,
            TurnParams.ROLE,
            TurnParams.TOOLS_CALLED,
        ],
        criteria=(
            "Evaluate whether the agent completed the task efficiently "
            "without unnecessary steps, redundant tool calls, or wasted "
            "interactions in the context of a Teradata DBA analysis."
        ),
        evaluation_steps=[
            "Check for redundant tool calls (same tool, same arguments called multiple times).",
            "Check for unnecessary clarifying questions (asking for info already provided).",
            "Assess whether the conversation could have been shorter for this task.",
            "Check if the agent combined related operations where possible.",
        ],
        threshold=threshold,
        async_mode=False,
    )


# ---------------------------------------------------------------------------
# Convenience: build all metrics at once
# ---------------------------------------------------------------------------


def build_all_metrics(
    available_tools: list[dict],
    task_description: str | None = None,
    model: Any | None = None,
) -> dict[str, Any]:
    """Build all 7 metrics for a full evaluation run.

    Returns a dict keyed by metric name for selective use.
    """
    judge = model or get_judge_model()
    return {
        "conversation_quality": conversation_quality_metric(judge),
        "knowledge_retention": knowledge_retention_metric(judge),
        "completeness": conversation_completeness_metric(judge),
        "tool_use": tool_use_metric(available_tools, judge),
        "role_adherence": role_adherence_metric(judge),
        "task_completion": task_completion_metric(task_description, judge),
        "trajectory_efficiency": trajectory_efficiency_metric(judge),
    }
