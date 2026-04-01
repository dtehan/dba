"""DeepEval metrics configured for Teradata DBA Agent evaluation.

Provides 7 metrics from the eval spec, using DeepEval's built-in
conversational metrics with domain-specific configuration.

Supports both AWS Bedrock (Claude) and Google Gemini as judge models
based on the EVAL_PROVIDER environment variable.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
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


def _get_bedrock_judge(
    model_id: str | None = None,
    region: str | None = None,
) -> Any:
    """Create a Bedrock model for use as an LLM judge."""
    from deepeval.models import AmazonBedrockModel

    region = region or os.environ.get("AWS_REGION", "us-west-2")
    model_id = model_id or os.environ.get(
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


def _get_gemini_judge(model_id: str | None = None) -> Any:
    """Create a Gemini model for use as an LLM judge.

    DeepEval supports Gemini natively via its GeminiModel class.
    Falls back to a string model identifier via litellm if GeminiModel
    is not available.
    """
    model_id = model_id or os.environ.get(
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
# Judge config loading
# ---------------------------------------------------------------------------

SUBAGENTS_DIR = Path(__file__).resolve().parent.parent.parent / "subagents"


def load_judge_config(agent_id: str) -> dict:
    """Load judge.json for a subagent. Returns empty dict if not found."""
    judge_path = SUBAGENTS_DIR / agent_id / "judge.json"
    if not judge_path.exists():
        return {}
    return json.loads(judge_path.read_text(encoding="utf-8"))


def get_judge_model_from_config(config: dict) -> Any:
    """Create a judge model from judge.json config, falling back to env defaults.

    The config's model.provider/model_id/region override env vars when non-null.
    """
    model_cfg = config.get("model", {})
    provider = model_cfg.get("provider") or os.environ.get("EVAL_PROVIDER", "bedrock")
    provider = provider.lower()

    model_id = model_cfg.get("model_id")  # None means use env default
    region = model_cfg.get("region")      # None means use env default

    if provider == "gemini":
        return _get_gemini_judge(model_id=model_id)

    return _get_bedrock_judge(model_id=model_id, region=region)


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


def build_metrics_from_judge_config(
    agent_id: str,
    available_tools: list[dict],
    task_description: str | None = None,
    model: Any | None = None,
) -> dict[str, Any]:
    """Build all 7 metrics using per-subagent judge.json config.

    Reads thresholds and custom criteria from subagents/{agent_id}/judge.json.
    Falls back to defaults if judge.json is missing or a field is absent.
    """
    config = load_judge_config(agent_id)
    metrics_cfg = config.get("metrics", {})

    if config and not model:
        judge = get_judge_model_from_config(config)
    else:
        judge = model or get_judge_model()

    # Conversation quality — supports custom criteria + steps
    cq = metrics_cfg.get("conversation_quality", {})
    cq_kwargs: dict[str, Any] = {"model": judge, "threshold": cq.get("threshold", 0.7)}
    if cq.get("criteria"):
        cq_kwargs["criteria"] = cq["criteria"]
    if cq.get("evaluation_steps"):
        cq_kwargs["evaluation_steps"] = cq["evaluation_steps"]

    # Task completion — supports custom criteria + steps
    tc = metrics_cfg.get("task_completion", {})
    tc_kwargs: dict[str, Any] = {
        "model": judge,
        "threshold": tc.get("threshold", 0.7),
        "task": task_description,
    }
    if tc.get("criteria"):
        tc_kwargs["criteria"] = tc["criteria"]
    if tc.get("evaluation_steps"):
        tc_kwargs["evaluation_steps"] = tc["evaluation_steps"]

    # Trajectory efficiency — supports custom criteria + steps
    te = metrics_cfg.get("trajectory_efficiency", {})
    te_kwargs: dict[str, Any] = {"model": judge, "threshold": te.get("threshold", 0.6)}
    if te.get("criteria"):
        te_kwargs["criteria"] = te["criteria"]
    if te.get("evaluation_steps"):
        te_kwargs["evaluation_steps"] = te["evaluation_steps"]

    # Built-in metrics — threshold only
    kr = metrics_cfg.get("knowledge_retention", {})
    cm = metrics_cfg.get("completeness", {})
    tu = metrics_cfg.get("tool_use", {})
    ra = metrics_cfg.get("role_adherence", {})

    return {
        "conversation_quality": _build_conversation_quality(**cq_kwargs),
        "knowledge_retention": knowledge_retention_metric(judge, kr.get("threshold", 0.7)),
        "completeness": conversation_completeness_metric(judge, cm.get("threshold", 0.7)),
        "tool_use": tool_use_metric(available_tools, judge, tu.get("threshold", 0.7)),
        "role_adherence": role_adherence_metric(judge, ra.get("threshold", 0.7)),
        "task_completion": _build_task_completion(**tc_kwargs),
        "trajectory_efficiency": _build_trajectory_efficiency(**te_kwargs),
    }


def _build_conversation_quality(
    model: Any,
    threshold: float = 0.7,
    criteria: str | None = None,
    evaluation_steps: list[str] | None = None,
) -> ConversationalGEval:
    """Build conversation quality metric with optional custom criteria."""
    return ConversationalGEval(
        name="Conversation Quality",
        model=model,
        evaluation_params=[TurnParams.CONTENT, TurnParams.ROLE],
        criteria=criteria or (
            "Evaluate the coherence, accuracy, and helpfulness of the "
            "assistant's responses across the entire conversation in the "
            "context of a Teradata DBA analysis tool."
        ),
        evaluation_steps=evaluation_steps or [
            "Check if the assistant maintains consistency across turns — no contradictions.",
            "Verify the assistant correctly references information from earlier turns.",
            "Assess whether the assistant builds on prior context rather than repeating information.",
            "Check if the assistant's technical explanations about Teradata are accurate.",
            "Evaluate whether clarifying questions are relevant and well-targeted.",
        ],
        threshold=threshold,
        async_mode=False,
    )


def _build_task_completion(
    model: Any,
    threshold: float = 0.7,
    task: str | None = None,
    criteria: str | None = None,
    evaluation_steps: list[str] | None = None,
) -> ConversationalGEval:
    """Build task completion metric with optional custom criteria."""
    task_desc = task or "the task described in the scenario"
    return ConversationalGEval(
        name="Task Completion",
        model=model,
        evaluation_params=[TurnParams.CONTENT, TurnParams.ROLE, TurnParams.TOOLS_CALLED],
        criteria=criteria or (
            f"Evaluate whether the assistant successfully completed the "
            f"following task: {task_desc}"
        ),
        evaluation_steps=evaluation_steps or [
            "Did the assistant address the core objective of the task?",
            "Did the assistant take appropriate action — either using tools to gather information, or correctly delegating to a specialized agent if the task description says delegation IS the goal?",
            "Is the final output complete and well-structured for what was asked?",
            "Does the output match the expected outcome described in the task?",
            "Are the conclusions, recommendations, or suggestions actionable?",
        ],
        threshold=threshold,
        async_mode=False,
    )


def _build_trajectory_efficiency(
    model: Any,
    threshold: float = 0.6,
    criteria: str | None = None,
    evaluation_steps: list[str] | None = None,
) -> ConversationalGEval:
    """Build trajectory efficiency metric with optional custom criteria."""
    return ConversationalGEval(
        name="Trajectory Efficiency",
        model=model,
        evaluation_params=[TurnParams.CONTENT, TurnParams.ROLE, TurnParams.TOOLS_CALLED],
        criteria=criteria or (
            "Evaluate whether the agent completed the task efficiently "
            "without unnecessary steps, redundant tool calls, or wasted "
            "interactions in the context of a Teradata DBA analysis."
        ),
        evaluation_steps=evaluation_steps or [
            "Check for redundant tool calls (same tool, same arguments called multiple times).",
            "Check for unnecessary clarifying questions (asking for info already provided).",
            "Assess whether the conversation could have been shorter for this task.",
            "Check if the agent combined related operations where possible.",
        ],
        threshold=threshold,
        async_mode=False,
    )
