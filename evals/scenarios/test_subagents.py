"""Eval tests for subagent system prompts.

Three test tiers:
1. Structural tests (no LLM calls) — validate prompt loading, tool filtering, scenario data
2. Live tests (real Bedrock calls) — run agent with mocked tools, check output quality
3. LLM judge tests (live + DeepEval metrics) — score conversations with LLM-as-judge
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from conftest import collect_subagent_scenarios
from harness.llm_client import run_agent, get_provider
from harness.deepeval_bridge import agent_result_to_test_case
from prompts.loader import load_subagent_config
from tools.definitions import get_tool_definitions

# ---------------------------------------------------------------------------
# Collect scenarios
# ---------------------------------------------------------------------------

SUBAGENT_SCENARIOS = collect_subagent_scenarios()


# ---------------------------------------------------------------------------
# Structural tests — no LLM calls, fast
# ---------------------------------------------------------------------------


class TestSubagentPromptLoading:
    """Verify all subagent prompts load and parse correctly."""

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_prompt_loads(self, scenario_id: str, scenario: dict):
        """Subagent prompt loads without errors."""
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        assert config.system_prompt, f"Empty system prompt for {scenario['agent_id']}"
        assert len(config.system_prompt) > 100, "System prompt suspiciously short"

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_tool_filter_valid(self, scenario_id: str, scenario: dict):
        """Tool filter produces non-empty tool list."""
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)
        assert len(tools) >= 1, "Must have at least td_syntax"
        tool_names = {t["name"] for t in tools}
        assert "td_syntax" in tool_names, "td_syntax always included"

    @pytest.mark.eval
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_scenario_success_criteria(self, scenario_id: str, scenario: dict):
        """Scenario has valid success criteria."""
        criteria = scenario.get("success_criteria", {})
        assert "required_tools" in criteria, "Must specify required_tools"
        assert "max_turns" in criteria, "Must specify max_turns"


# ---------------------------------------------------------------------------
# Live tests — require Bedrock credentials
# ---------------------------------------------------------------------------


class TestSubagentLive:
    """Run subagents against Bedrock with mocked tools and validate output."""

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_agent_completes(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent runs to completion and produces non-empty output."""
        client, model_id = bedrock_client
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)

        result = run_agent(
            client=client,
            model_id=model_id,
            provider=get_provider(),
            system_prompt=config.system_prompt,
            messages=[{"role": "user", "content": config.initial_message}],
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=config.max_tool_rounds,
            max_tokens=config.max_tokens,
        )

        assert result.final_text, "Agent produced no output text"
        assert len(result.final_text) > 200, "Output suspiciously short"
        assert result.rounds_used > 0, "Agent used zero rounds"

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_required_tools_called(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent calls all required tools from success criteria."""
        client, model_id = bedrock_client
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)

        result = run_agent(
            client=client,
            model_id=model_id,
            provider=get_provider(),
            system_prompt=config.system_prompt,
            messages=[{"role": "user", "content": config.initial_message}],
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=config.max_tool_rounds,
            max_tokens=config.max_tokens,
        )

        criteria = scenario.get("success_criteria", {})
        tools_used = {tc.name for tc in result.tool_calls}

        required = set(criteria.get("required_tools", []))
        missing = required - tools_used
        assert not missing, f"Required tools not called: {missing}"

        forbidden = set(criteria.get("forbidden_tools", []))
        violated = tools_used & forbidden
        assert not violated, f"Forbidden tools called: {violated}"

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_must_mention_terms(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent output contains all required terms."""
        client, model_id = bedrock_client
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)

        result = run_agent(
            client=client,
            model_id=model_id,
            provider=get_provider(),
            system_prompt=config.system_prompt,
            messages=[{"role": "user", "content": config.initial_message}],
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=config.max_tool_rounds,
            max_tokens=config.max_tokens,
        )

        criteria = scenario.get("success_criteria", {})
        output_lower = result.final_text.lower()

        for term in criteria.get("must_mention", []):
            assert term.lower() in output_lower, (
                f"Required term '{term}' not found in output"
            )

        for term in criteria.get("must_not_mention", []):
            assert term.lower() not in output_lower, (
                f"Forbidden term '{term}' found in output"
            )

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.timeout(300)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_structural_checks(
        self, scenario_id: str, scenario: dict, bedrock_client, tool_mocks
    ):
        """Agent output satisfies structural checks (sections, min tool calls)."""
        structural = scenario.get("structural_checks")
        if not structural:
            pytest.skip("No structural_checks defined")

        client, model_id = bedrock_client
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)

        result = run_agent(
            client=client,
            model_id=model_id,
            provider=get_provider(),
            system_prompt=config.system_prompt,
            messages=[{"role": "user", "content": config.initial_message}],
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=config.max_tool_rounds,
            max_tokens=config.max_tokens,
        )

        # Check minimum tool calls
        min_calls = structural.get("min_tool_calls", 0)
        assert len(result.tool_calls) >= min_calls, (
            f"Expected >= {min_calls} tool calls, got {len(result.tool_calls)}"
        )

        # Check output sections present
        output_lower = result.final_text.lower()
        for section in structural.get("output_sections", []):
            assert section.lower() in output_lower, (
                f"Expected section '{section}' not found in output"
            )

        # Check traffic light ratings present
        if structural.get("traffic_light_present"):
            has_traffic = any(
                color in output_lower
                for color in ["green", "yellow", "red"]
            )
            assert has_traffic, "No traffic-light ratings (GREEN/YELLOW/RED) in output"


# ---------------------------------------------------------------------------
# LLM Judge tests — require Bedrock credentials, expensive
# ---------------------------------------------------------------------------


class TestSubagentLLMJudge:
    """Score subagent conversations using DeepEval LLM-as-judge metrics."""

    def _run_agent(self, scenario, bedrock_client, tool_mocks):
        """Helper: run agent and return (result, config)."""
        client, model_id = bedrock_client
        config = load_subagent_config(
            scenario["agent_id"], scenario.get("params", {})
        )
        tools = get_tool_definitions(config.tool_filter)

        result = run_agent(
            client=client,
            model_id=model_id,
            provider=get_provider(),
            system_prompt=config.system_prompt,
            messages=[{"role": "user", "content": config.initial_message}],
            tools=tools,
            tool_executor=tool_mocks,
            max_rounds=config.max_tool_rounds,
            max_tokens=config.max_tokens,
        )
        return result, config

    @pytest.mark.eval
    @pytest.mark.live
    @pytest.mark.llm_judge
    @pytest.mark.timeout(600)
    @pytest.mark.parametrize(
        "scenario_id,scenario",
        SUBAGENT_SCENARIOS,
        ids=[s[0] for s in SUBAGENT_SCENARIOS],
    )
    def test_all_judge_metrics(
        self, scenario_id, scenario, bedrock_client, tool_mocks, judge_model
    ):
        """Score agent against all 7 metrics from judge.json."""
        if judge_model is None:
            pytest.skip("No AWS credentials for LLM judge")

        from metrics.custom_metrics import build_metrics_from_judge_config

        result, config = self._run_agent(scenario, bedrock_client, tool_mocks)
        test_case = agent_result_to_test_case(result, scenario, config.name)
        tools = get_tool_definitions(config.tool_filter)

        metrics = build_metrics_from_judge_config(
            agent_id=scenario["agent_id"],
            available_tools=tools,
            task_description=scenario.get("expected_outcome"),
            model=judge_model,
        )

        failures = []
        for name, metric in metrics.items():
            metric.measure(test_case)
            if metric.score < metric.threshold:
                failures.append(
                    f"{name}: {metric.score:.2f} < {metric.threshold} — {metric.reason}"
                )

        assert not failures, (
            f"{len(failures)} metric(s) below threshold:\n" +
            "\n".join(f"  - {f}" for f in failures)
        )
