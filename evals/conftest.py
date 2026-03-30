"""Shared pytest fixtures for the eval harness."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Ensure evals package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness.bedrock_client import get_bedrock_client
from prompts.loader import load_subagent_config, list_subagent_ids
from prompts.freeform import build_system_prompt
from tools.definitions import get_tool_definitions
from tools.mocks import ToolMockDispatcher

SCENARIOS_DIR = Path(__file__).resolve().parent / "scenarios" / "data"


@pytest.fixture(scope="session")
def bedrock_client():
    """Session-scoped Bedrock client. Requires AWS credentials in env."""
    client, model_id = get_bedrock_client()
    return client, model_id


@pytest.fixture(scope="session")
def tool_mocks():
    """Session-scoped tool mock dispatcher."""
    return ToolMockDispatcher()


@pytest.fixture(scope="session")
def all_subagent_ids():
    """List of all subagent IDs available."""
    return list_subagent_ids()


@pytest.fixture(scope="session")
def judge_model():
    """Session-scoped DeepEval judge model (Bedrock).

    Returns None if Bedrock is unreachable, allowing tests to skip gracefully.
    Tries to create the model — if AWS credentials are available via env vars,
    ~/.aws/credentials, or IAM role, it will succeed.
    """
    try:
        from metrics.custom_metrics import get_judge_model
        return get_judge_model()
    except Exception:
        return None


def load_scenario(path: str | Path) -> dict:
    """Load a scenario JSON file."""
    with open(path) as f:
        return json.load(f)


def collect_subagent_scenarios() -> list[tuple[str, dict]]:
    """Collect all subagent scenario JSON files for parametrization."""
    subagent_dir = SCENARIOS_DIR / "subagents"
    if not subagent_dir.exists():
        return []
    scenarios = []
    for f in sorted(subagent_dir.glob("*.json")):
        data = load_scenario(f)
        scenarios.append((data["id"], data))
    return scenarios


def collect_freeform_scenarios() -> list[tuple[str, dict]]:
    """Collect all freeform chat scenario JSON files."""
    freeform_dir = SCENARIOS_DIR / "freeform_chat"
    if not freeform_dir.exists():
        return []
    scenarios = []
    for f in sorted(freeform_dir.glob("*.json")):
        data = load_scenario(f)
        scenarios.append((data["id"], data))
    return scenarios


# ---------------------------------------------------------------------------
# Cost tracking — print token usage summary at end of session
# ---------------------------------------------------------------------------

def pytest_sessionstart(session):
    """Reset cost tracker at session start."""
    from cost_tracker import reset_tracker
    reset_tracker()


def pytest_sessionfinish(session, exitstatus):
    """Print cost summary at session end if any API calls were made."""
    from cost_tracker import get_tracker
    tracker = get_tracker()
    if tracker.total_calls > 0:
        print(tracker.summary_text())

        # Optionally write to JSON
        cost_output = os.environ.get("EVAL_COST_OUTPUT")
        if cost_output:
            Path(cost_output).write_text(
                json.dumps(tracker.summary(), indent=2)
            )
