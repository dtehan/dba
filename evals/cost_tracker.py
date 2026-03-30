"""Cost tracking plugin for eval runs.

Wraps the agent runner to capture token usage from Anthropic API responses.
Produces a summary at the end of the test session.

Usage as pytest plugin (auto-loaded via conftest.py):
    Results printed at end of session and optionally saved to JSON.

Usage standalone:
    from cost_tracker import CostTracker
    tracker = CostTracker()
    tracker.record(input_tokens=1500, output_tokens=800, model="claude-sonnet")
    print(tracker.summary())
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path


# Approximate pricing per 1K tokens (Bedrock Claude Sonnet 4, us-west-2)
# Update these as pricing changes
MODEL_PRICING = {
    "us.anthropic.claude-sonnet-4-20250514-v1:0": {
        "input_per_1k": 0.003,
        "output_per_1k": 0.015,
    },
    # Fallback for unknown models
    "default": {
        "input_per_1k": 0.003,
        "output_per_1k": 0.015,
    },
}


@dataclass
class TokenRecord:
    """Single API call token usage."""
    input_tokens: int
    output_tokens: int
    model: str
    caller: str  # "agent" or "judge"
    timestamp: float = field(default_factory=time.time)


class CostTracker:
    """Accumulates token usage across an eval session."""

    def __init__(self):
        self.records: list[TokenRecord] = []

    def record(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str = "",
        caller: str = "agent",
    ) -> None:
        self.records.append(TokenRecord(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            caller=caller,
        ))

    @property
    def total_input_tokens(self) -> int:
        return sum(r.input_tokens for r in self.records)

    @property
    def total_output_tokens(self) -> int:
        return sum(r.output_tokens for r in self.records)

    @property
    def total_calls(self) -> int:
        return len(self.records)

    def estimated_cost(self) -> float:
        """Estimate total cost in USD based on token counts."""
        total = 0.0
        for r in self.records:
            pricing = MODEL_PRICING.get(r.model, MODEL_PRICING["default"])
            total += (r.input_tokens / 1000) * pricing["input_per_1k"]
            total += (r.output_tokens / 1000) * pricing["output_per_1k"]
        return total

    def summary(self) -> dict:
        """Produce a summary dict."""
        agent_records = [r for r in self.records if r.caller == "agent"]
        judge_records = [r for r in self.records if r.caller == "judge"]

        return {
            "total_api_calls": self.total_calls,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "estimated_cost_usd": round(self.estimated_cost(), 4),
            "by_caller": {
                "agent": {
                    "calls": len(agent_records),
                    "input_tokens": sum(r.input_tokens for r in agent_records),
                    "output_tokens": sum(r.output_tokens for r in agent_records),
                },
                "judge": {
                    "calls": len(judge_records),
                    "input_tokens": sum(r.input_tokens for r in judge_records),
                    "output_tokens": sum(r.output_tokens for r in judge_records),
                },
            },
        }

    def summary_text(self) -> str:
        """Human-readable summary."""
        s = self.summary()
        lines = [
            "",
            "=" * 50,
            "  Eval Cost Summary",
            "=" * 50,
            f"  API calls:      {s['total_api_calls']}",
            f"  Input tokens:   {s['total_input_tokens']:,}",
            f"  Output tokens:  {s['total_output_tokens']:,}",
            f"  Total tokens:   {s['total_tokens']:,}",
            f"  Est. cost:      ${s['estimated_cost_usd']:.4f}",
            "",
            f"  Agent calls:    {s['by_caller']['agent']['calls']}",
            f"  Judge calls:    {s['by_caller']['judge']['calls']}",
            "=" * 50,
        ]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Global tracker instance (shared across test session)
# ---------------------------------------------------------------------------

_global_tracker = CostTracker()


def get_tracker() -> CostTracker:
    """Get the global cost tracker instance."""
    return _global_tracker


def reset_tracker() -> None:
    """Reset for a new session."""
    global _global_tracker
    _global_tracker = CostTracker()
