"""CLI entry point for DSPy prompt optimization.

Usage:
    uv run python -m optimization.run_optimization [OPTIONS]

Options:
    --agent AGENT_ID    Optimize a specific subagent (default: all)
    --freeform          Optimize the freeform chat prompt only
    --all               Optimize everything (default)
    --trials N          MIPROv2 trials (default: 20)
    --candidates N      Instruction candidates per round (default: 7)
    --validate          Run full eval suite after optimization
    --dry-run           Show what would be optimized without running

Optimized prompts are written back to the original files automatically.
Previous versions are archived to subagents/versions/ with metadata.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from optimization.optimizer import (
    optimize_all,
    optimize_freeform,
    optimize_subagent,
)
from optimization.dspy_lm import configure_dspy_lm


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Optimize Teradata DBA Agent prompts with DSPy MIPROv2"
    )
    parser.add_argument(
        "--agent",
        type=str,
        default=None,
        help="Optimize a specific subagent by ID (e.g. system-health)",
    )
    parser.add_argument(
        "--freeform",
        action="store_true",
        help="Optimize the freeform chat prompt only",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        default=True,
        dest="optimize_all",
        help="Optimize all prompts (default)",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=20,
        help="Number of MIPROv2 optimization trials (default: 20)",
    )
    parser.add_argument(
        "--candidates",
        type=int,
        default=7,
        help="Instruction candidates per round (default: 7)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run full eval suite after optimization",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be optimized without running",
    )

    args = parser.parse_args()

    # Configure DSPy LM (unless dry-run)
    if not args.dry_run:
        print("Configuring DSPy with Bedrock LM...")
        configure_dspy_lm()

    # Dispatch
    if args.agent:
        print(f"\nOptimizing subagent: {args.agent}")
        result = optimize_subagent(
            args.agent,
            trials=args.trials,
            num_candidates=args.candidates,
            dry_run=args.dry_run,
        )
        results = [result] if result else []
    elif args.freeform:
        print("\nOptimizing freeform chat prompt")
        result = optimize_freeform(
            trials=args.trials,
            num_candidates=args.candidates,
            dry_run=args.dry_run,
        )
        results = [result] if result else []
    else:
        results = optimize_all(
            trials=args.trials,
            num_candidates=args.candidates,
            dry_run=args.dry_run,
        )

    if not results:
        print("\nNo prompts were optimized.")
        return 1

    # Post-optimization validation
    if args.validate and not args.dry_run:
        print("\n" + "=" * 60)
        print("Running full eval suite for validation...")
        print("=" * 60)
        evals_dir = Path(__file__).resolve().parent.parent
        exit_code = subprocess.call(
            ["uv", "run", "pytest", "-m", "eval", "--timeout=600", "-v"],
            cwd=evals_dir,
        )
        if exit_code != 0:
            print(f"\nValidation failed with exit code {exit_code}")
            return exit_code

    changed = sum(1 for r in results if r.changed)
    print(f"\nDone. {changed}/{len(results)} prompts updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
