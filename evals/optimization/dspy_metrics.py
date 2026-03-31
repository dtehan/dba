"""Bridge DeepEval metrics into DSPy-compatible metric callables.

DSPy metrics have the signature ``metric(example, prediction, trace=None) -> float``.
This module provides:
  - ``structural_score``: fast, no LLM — checks success_criteria from scenario
  - ``make_llm_metric``: wraps one or more DeepEval metrics as a DSPy metric
  - ``make_composite_metric``: weighted combination used during optimization
"""

from __future__ import annotations

import re
from typing import Any, Callable

import dspy

from harness.agent_runner import ConversationResult, ToolCall
from harness.deepeval_bridge import agent_result_to_test_case
from metrics.custom_metrics import (
    get_judge_model,
    role_adherence_metric,
    task_completion_metric,
    trajectory_efficiency_metric,
)


def structural_score(
    example: dspy.Example,
    prediction: dspy.Prediction,
    trace: Any = None,
) -> float:
    """Score based on scenario success_criteria — no LLM calls.

    Checks:
      - required_tools: all required tools were called
      - must_mention: required terms appear in the output
      - must_not_mention: forbidden terms are absent
    """
    scenario = example.scenario_data
    criteria = scenario.get("success_criteria", {})
    report = getattr(prediction, "report", "") or ""
    tool_calls: list[ToolCall] = getattr(prediction, "tool_calls", [])

    checks: list[float] = []

    # Required tools
    tools_used = {tc.name for tc in tool_calls}
    for tool in criteria.get("required_tools", []):
        checks.append(1.0 if tool in tools_used else 0.0)

    # Forbidden tools
    for tool in criteria.get("forbidden_tools", []):
        checks.append(1.0 if tool not in tools_used else 0.0)

    # Must mention
    report_lower = report.lower()
    for term in criteria.get("must_mention", []):
        checks.append(1.0 if term.lower() in report_lower else 0.0)

    # Must not mention
    for term in criteria.get("must_not_mention", []):
        checks.append(1.0 if term.lower() not in report_lower else 0.0)

    if not checks:
        return 1.0
    return sum(checks) / len(checks)


def template_vars_preserved(
    original_template: str,
    optimized_instruction: str,
) -> bool:
    """Check that all ``{{variable}}`` markers from the original appear in the optimized text."""
    original_vars = set(re.findall(r"\{\{[#^/]?(\w+)\}\}", original_template))
    optimized_vars = set(re.findall(r"\{\{[#^/]?(\w+)\}\}", optimized_instruction))
    return original_vars <= optimized_vars


def _prediction_to_conversation_result(
    prediction: dspy.Prediction,
) -> ConversationResult:
    """Reconstruct a ConversationResult from prediction metadata."""
    return ConversationResult(
        messages=getattr(prediction, "messages", []),
        final_text=getattr(prediction, "report", "") or "",
        tool_calls=getattr(prediction, "tool_calls", []),
        rounds_used=getattr(prediction, "rounds_used", 0),
        stop_reason=getattr(prediction, "stop_reason", "end_turn"),
    )


def make_llm_metric(
    metric_factories: list[Callable],
    judge_model: Any = None,
) -> Callable[[dspy.Example, dspy.Prediction, Any], float]:
    """Create a DSPy metric that runs DeepEval metrics and averages scores.

    Args:
        metric_factories: callables that return DeepEval metric instances.
            Each is called with ``(model=judge_model)`` or
            ``(model=judge_model, threshold=0.0)`` for scoring without
            a pass/fail gate.
        judge_model: DeepEval ``AmazonBedrockModel`` instance. Created
            lazily from env vars if not provided.
    """

    def metric_fn(
        example: dspy.Example,
        prediction: dspy.Prediction,
        trace: Any = None,
    ) -> float:
        nonlocal judge_model
        if judge_model is None:
            judge_model = get_judge_model()

        result = _prediction_to_conversation_result(prediction)
        scenario = example.scenario_data
        chatbot_role = scenario.get("chatbot_role")
        test_case = agent_result_to_test_case(result, scenario, chatbot_role)

        scores: list[float] = []
        for factory in metric_factories:
            m = factory(model=judge_model, threshold=0.0)
            m.measure(test_case)
            scores.append(m.score)

        return sum(scores) / len(scores) if scores else 0.0

    return metric_fn


def make_composite_metric(
    original_template: str | None = None,
    judge_model: Any = None,
) -> Callable[[dspy.Example, dspy.Prediction, Any], float]:
    """Create the weighted composite metric used during optimization.

    Weights:
      - 40% structural_score (free)
      - 20% task_completion (LLM judge)
      - 20% role_adherence (LLM judge)
      - 20% trajectory_efficiency (LLM judge)

    If ``original_template`` is provided, returns 0.0 for any candidate
    that drops template variables.
    """
    llm_metric = make_llm_metric(
        metric_factories=[
            task_completion_metric,
            role_adherence_metric,
            trajectory_efficiency_metric,
        ],
        judge_model=judge_model,
    )

    def metric_fn(
        example: dspy.Example,
        prediction: dspy.Prediction,
        trace: Any = None,
    ) -> float:
        # Guard: reject candidates that lose template variables
        if original_template:
            instruction = getattr(prediction, "instruction_used", "")
            if instruction and not template_vars_preserved(
                original_template, instruction
            ):
                return 0.0

        s_score = structural_score(example, prediction, trace)
        llm_score = llm_metric(example, prediction, trace)

        return 0.4 * s_score + 0.6 * llm_score

    return metric_fn
