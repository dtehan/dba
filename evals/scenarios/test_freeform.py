"""Eval tests for freeform chat system prompt.

Three tiers:
1. Structural tests — validate scenario data and prompt loading (no LLM)
2. Live tests — run agent against Bedrock with mocked tools
3. Scripted + LLM judge — score pre-written conversations with DeepEval metrics
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from conftest import collect_freeform_scenarios
from harness.agent_runner import run_agent_loop
from harness.deepeval_bridge import agent_result_to_test_case, scripted_scenario_to_test_case
from prompts.freeform import build_system_prompt
from prompts.loader import load_all_subagent_configs
from tools.definitions import get_tool_definitions

# ---------------------------------------------------------------------------
# Collect scenarios
# ---------------------------------------------------------------------------

FREEFORM_SCENARIOS = collect_freeform_scenarios()


def _build_freeform_system_prompt() -> str:
    """Build the full freeform system prompt with subagent directory."""
    configs = load_all_subagent_configs()
    agents = [
        {"name": c.name, "description": c.description, "category": c.category}
        for c in configs
    ]
    return build_system_prompt(agents=agents)


# ---------------------------------------------------------------------------
# Structural tests — no LLM calls
# ---------------------------------------------------------------------------


class TestFreeformScenarioData:
    """Validate freeform scenario JSON files."""

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        FREEFORM_SCENARIOS,
        ids=[s[0] for s in FREEFORM_SCENARIOS],
    )
    def test_scenario_has_required_fields(self, scenario_id: str, scenario: dict):
        """Scenario JSON has all required fields."""
        assert "chatbot_role" in scenario
        assert "expected_outcome" in scenario
        assert "success_criteria" in scenario
        mode = scenario.get("mode")
        assert mode in ("scripted", "live"), f"Invalid mode: {mode}"

        if mode == "scripted":
            assert "turns" in scenario, "Scripted scenario must have turns"
            assert len(scenario["turns"]) >= 2, "Need at least 1 exchange"
        else:
            assert "initial_messages" in scenario, "Live scenario needs initial_messages"

    @pytest.mark.eval
    def test_system_prompt_builds(self):
        """Freeform system prompt builds correctly with subagent list."""
        prompt = _build_freeform_system_prompt()
        assert len(prompt) > 500, "Prompt too short"
        assert "Teradata DBA assistant" in prompt
        assert "Specialized Subagents" in prompt
        assert "Security Audit" in prompt


# ---------------------------------------------------------------------------
# Scripted scenario tests — LLM judge scores pre-written conversations
# ---------------------------------------------------------------------------

SCRIPTED_SCENARIOS = [
    (sid, s) for sid, s in FREEFORM_SCENARIOS if s.get("mode") == "scripted"
]


class TestFreeformScripted:
    """Score pre-written freeform conversations with structural checks."""

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SCRIPTED_SCENARIOS,
        ids=[s[0] for s in SCRIPTED_SCENARIOS],
    )
    def test_scripted_must_mention(self, scenario_id: str, scenario: dict):
        """Scripted conversation contains required terms."""
        criteria = scenario.get("success_criteria", {})
        all_text = " ".join(
            t["content"].lower() for t in scenario["turns"] if t["role"] == "assistant"
        )
        for term in criteria.get("must_mention", []):
            assert term.lower() in all_text, (
                f"Required term '{term}' not found in assistant turns"
            )

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SCRIPTED_SCENARIOS,
        ids=[s[0] for s in SCRIPTED_SCENARIOS],
    )
    def test_scripted_must_not_mention(self, scenario_id: str, scenario: dict):
        """Scripted conversation avoids forbidden terms."""
        criteria = scenario.get("success_criteria", {})
        all_text = " ".join(
            t["content"].lower() for t in scenario["turns"] if t["role"] == "assistant"
        )
        for term in criteria.get("must_not_mention", []):
            assert term.lower() not in all_text, (
                f"Forbidden term '{term}' found in assistant turns"
            )


# ---------------------------------------------------------------------------
# Live tests — real Bedrock calls with mocked tools
# ---------------------------------------------------------------------------

LIVE_SCENARIOS = [
    (sid, s) for sid, s in FREEFORM_SCENARIOS if s.get("mode") == "live"
]


class TestFreeformLive:
    """Run freeform chat against Bedrock with mocked tools."""

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        LIVE_SCENARIOS,
        ids=[s[0] for s in LIVE_SCENARIOS],
    )
    def test_agent_completes(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent runs to completion with non-empty output."""
        client, model_id = bedrock_client
        system_prompt = _build_freeform_system_prompt()
        tools = get_tool_definitions()

        initial = scenario.get("initial_messages", [])
        result = run_agent_loop(
            client=client,
            model=model_id,
            system_prompt=system_prompt,
            messages=initial,
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=10,
            max_tokens=4096,
        )

        assert result.final_text, "Agent produced no output"
        assert len(result.final_text) > 50, "Output suspiciously short"

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        LIVE_SCENARIOS,
        ids=[s[0] for s in LIVE_SCENARIOS],
    )
    def test_success_criteria(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent output meets success criteria."""
        client, model_id = bedrock_client
        system_prompt = _build_freeform_system_prompt()
        tools = get_tool_definitions()

        initial = scenario.get("initial_messages", [])
        result = run_agent_loop(
            client=client,
            model=model_id,
            system_prompt=system_prompt,
            messages=initial,
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=10,
            max_tokens=4096,
        )

        criteria = scenario.get("success_criteria", {})
        output_lower = result.final_text.lower()

        # Check must_mention
        for term in criteria.get("must_mention", []):
            assert term.lower() in output_lower, (
                f"Required term '{term}' not found in output"
            )

        # Check must_not_mention
        for term in criteria.get("must_not_mention", []):
            assert term.lower() not in output_lower, (
                f"Forbidden term '{term}' found in output"
            )

        # Check required tools
        tools_used = {tc.name for tc in result.tool_calls}
        required = set(criteria.get("required_tools", []))
        missing = required - tools_used
        assert not missing, f"Required tools not called: {missing}"

        # Check subagent suggestion if specified
        structural = scenario.get("structural_checks", {})
        suggested_agent = structural.get("must_suggest_subagent")
        if suggested_agent:
            assert suggested_agent.lower() in output_lower, (
                f"Expected suggestion for '{suggested_agent}' subagent not found"
            )


# ---------------------------------------------------------------------------
# LLM Judge tests — score conversations with DeepEval metrics
# ---------------------------------------------------------------------------


class TestFreeformLLMJudge:
    """Score freeform chat conversations using DeepEval LLM-as-judge metrics."""

    @pytest.mark.eval
    @pytest.mark.llm_judge
    @pytest.mark.timeout(600)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SCRIPTED_SCENARIOS,
        ids=[s[0] for s in SCRIPTED_SCENARIOS],
    )
    def test_scripted_conversation_quality(
        self, scenario_id, scenario, judge_model
    ):
        """Score pre-written conversations for quality (no agent LLM calls)."""
        if judge_model is None:
            pytest.skip("No AWS credentials for LLM judge")

        from metrics.custom_metrics import conversation_quality_metric

        test_case = scripted_scenario_to_test_case(scenario)
        metric = conversation_quality_metric(model=judge_model, threshold=0.7)
        metric.measure(test_case)

        assert metric.score >= metric.threshold, (
            f"Conversation quality score {metric.score:.2f} below threshold "
            f"{metric.threshold} — reason: {metric.reason}"
        )

    @pytest.mark.eval
    @pytest.mark.llm_judge
    @pytest.mark.timeout(600)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SCRIPTED_SCENARIOS,
        ids=[s[0] for s in SCRIPTED_SCENARIOS],
    )
    def test_scripted_knowledge_retention(
        self, scenario_id, scenario, judge_model
    ):
        """Score pre-written conversations for knowledge retention across turns.

        Only meaningful for conversations where later turns reference earlier
        context. Single-topic Q&A scenarios are skipped.
        """
        if judge_model is None:
            pytest.skip("No AWS credentials for LLM judge")

        # Knowledge retention requires multi-turn context building where
        # later turns reference facts from earlier turns. Simple Q&A
        # with independent questions doesn't exercise retention.
        turns = scenario.get("turns", [])
        if len(turns) < 8:
            pytest.skip("Too few turns for meaningful knowledge retention test")

        from metrics.custom_metrics import knowledge_retention_metric

        test_case = scripted_scenario_to_test_case(scenario)
        metric = knowledge_retention_metric(model=judge_model, threshold=0.7)
        metric.measure(test_case)

        assert metric.score >= metric.threshold, (
            f"Knowledge retention score {metric.score:.2f} below threshold "
            f"{metric.threshold} — reason: {metric.reason}"
        )

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.llm_judge
    @pytest.mark.timeout(600)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        LIVE_SCENARIOS,
        ids=[s[0] for s in LIVE_SCENARIOS],
    )
    def test_live_role_adherence(
        self, scenario_id, scenario, bedrock_client, tool_mocks, judge_model
    ):
        """Score live agent responses for role adherence."""
        if judge_model is None:
            pytest.skip("No AWS credentials for LLM judge")

        from metrics.custom_metrics import role_adherence_metric

        client, model_id = bedrock_client
        system_prompt = _build_freeform_system_prompt()
        tools = get_tool_definitions()
        initial = scenario.get("initial_messages", [])

        result = run_agent_loop(
            client=client,
            model=model_id,
            system_prompt=system_prompt,
            messages=initial,
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=10,
            max_tokens=4096,
        )

        test_case = agent_result_to_test_case(result, scenario)
        metric = role_adherence_metric(model=judge_model, threshold=0.7)
        metric.measure(test_case)

        assert metric.score >= metric.threshold, (
            f"Role adherence score {metric.score:.2f} below threshold "
            f"{metric.threshold} — reason: {metric.reason}"
        )

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.llm_judge
    @pytest.mark.timeout(600)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        LIVE_SCENARIOS,
        ids=[s[0] for s in LIVE_SCENARIOS],
    )
    def test_live_task_completion(
        self, scenario_id, scenario, bedrock_client, tool_mocks, judge_model
    ):
        """Score live agent responses for task completion."""
        if judge_model is None:
            pytest.skip("No AWS credentials for LLM judge")

        from metrics.custom_metrics import task_completion_metric

        client, model_id = bedrock_client
        system_prompt = _build_freeform_system_prompt()
        tools = get_tool_definitions()
        initial = scenario.get("initial_messages", [])

        result = run_agent_loop(
            client=client,
            model=model_id,
            system_prompt=system_prompt,
            messages=initial,
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=10,
            max_tokens=4096,
        )

        test_case = agent_result_to_test_case(result, scenario)

        # Delegation scenarios (agent suggests subagent) get a lower threshold
        # since the judge penalizes not doing the work directly
        structural = scenario.get("structural_checks", {})
        threshold = 0.5 if structural.get("must_suggest_subagent") else 0.7

        metric = task_completion_metric(
            task=scenario.get("expected_outcome"),
            model=judge_model,
            threshold=threshold,
        )
        metric.measure(test_case)

        assert metric.score >= metric.threshold, (
            f"Task completion score {metric.score:.2f} below threshold "
            f"{metric.threshold} — reason: {metric.reason}"
        )
