"""Convert eval scenario JSON files into DSPy Example objects.

Reads the same scenario data used by pytest tests and packages it for
DSPy's optimizer train/validation sets.
"""

from __future__ import annotations

import json
from pathlib import Path

import dspy

from prompts.loader import load_subagent_config, list_subagent_ids

SCENARIOS_DIR = Path(__file__).resolve().parent.parent / "scenarios" / "data"
SUBAGENT_SCENARIOS_DIR = SCENARIOS_DIR / "subagents"
FREEFORM_SCENARIOS_DIR = SCENARIOS_DIR / "freeform_chat"


def load_subagent_examples(agent_id: str) -> list[dspy.Example]:
    """Load all scenario examples for a single subagent.

    Each example contains:
      - task: the initial message sent to the agent
      - scenario_data: the full scenario dict (for metric access)
      - agent_id: subagent identifier
      - params: scenario params dict for template rendering
    """
    # Scenario filenames use underscores, agent IDs use hyphens
    filename = agent_id.replace("-", "_")
    scenario_path = SUBAGENT_SCENARIOS_DIR / f"{filename}.json"
    if not scenario_path.exists():
        # Fall back to hyphenated name
        scenario_path = SUBAGENT_SCENARIOS_DIR / f"{agent_id}.json"
    if not scenario_path.exists():
        return []

    scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
    params = scenario.get("params", {})

    # Load config to get the rendered initial message
    config = load_subagent_config(agent_id, params)

    return [
        dspy.Example(
            task=config.initial_message,
            scenario_data=scenario,
            agent_id=agent_id,
            params=params,
        ).with_inputs("task")
    ]


def load_freeform_examples() -> list[dspy.Example]:
    """Load freeform chat scenarios that are live (not scripted).

    Scripted scenarios have pre-written turns and don't exercise the
    agent loop, so they aren't useful for prompt optimization.
    """
    examples = []
    if not FREEFORM_SCENARIOS_DIR.exists():
        return examples

    for path in sorted(FREEFORM_SCENARIOS_DIR.glob("*.json")):
        scenario = json.loads(path.read_text(encoding="utf-8"))
        if scenario.get("mode") != "live":
            continue

        # Live freeform scenarios have initial_messages or a single
        # initial message to kick off the conversation.
        initial_messages = scenario.get("initial_messages", [])
        if initial_messages:
            task = initial_messages[0].get("content", "")
        else:
            task = scenario.get("initial_message", "Hello")

        examples.append(
            dspy.Example(
                task=task,
                scenario_data=scenario,
                agent_id="freeform",
                params={},
            ).with_inputs("task")
        )

    return examples


def load_all_examples() -> dict[str, list[dspy.Example]]:
    """Load all examples grouped by agent_id.

    Returns a dict mapping agent_id → list of dspy.Example.
    The key ``"freeform"`` holds freeform chat examples.
    """
    result: dict[str, list[dspy.Example]] = {}

    for agent_id in list_subagent_ids():
        examples = load_subagent_examples(agent_id)
        if examples:
            result[agent_id] = examples

    freeform = load_freeform_examples()
    if freeform:
        result["freeform"] = freeform

    return result
