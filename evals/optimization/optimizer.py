"""MIPROv2 optimizer configuration and per-agent optimization orchestration.

Runs DSPy's MIPROv2 in instruction-only mode to rewrite system prompt text
without injecting few-shot examples.  Always writes the best prompt back
to the original file and versions the previous prompt before overwriting.
"""

from __future__ import annotations

import difflib
import logging
import sys
import warnings
from typing import Any

import dspy
from dspy.teleprompt import MIPROv2

from harness.bedrock_client import get_bedrock_client
from prompts.loader import load_subagent_config, list_subagent_ids, _parse_frontmatter, SUBAGENTS_DIR
from prompts.freeform import BASE_SYSTEM_PROMPT
from tools.mocks import ToolMockDispatcher

from optimization.dataset import load_subagent_examples, load_freeform_examples
from optimization.dspy_lm import configure_dspy_lm
from optimization.dspy_metrics import make_composite_metric
from optimization.dspy_modules import SubagentModule, FreeformChatModule
from optimization.prompt_writer import write_optimized_subagent, write_optimized_freeform

# Suppress harmless deep-copy warnings from DSPy when it copies modules
# containing the Anthropic Bedrock client (httpx doesn't survive deepcopy)
logging.getLogger("dspy.primitives.module").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*Failed to deep copy.*")


class OptimizationResult:
    """Result of optimizing a single prompt."""

    def __init__(
        self,
        agent_id: str,
        original_instruction: str,
        optimized_instruction: str,
        best_score: float,
        baseline_score: float = 0.0,
        trials: int = 0,
    ):
        self.agent_id = agent_id
        self.original_instruction = original_instruction
        self.optimized_instruction = optimized_instruction
        self.best_score = best_score
        self.baseline_score = baseline_score
        self.trials = trials

    @property
    def changed(self) -> bool:
        return self.original_instruction.strip() != self.optimized_instruction.strip()


def _print_prompt_result(result: OptimizationResult) -> None:
    """Print the optimization outcome: score, diff, and best prompt."""
    print()
    print(f"  Baseline score: {result.baseline_score:.3f}")
    print(f"  Best score:     {result.best_score:.3f}")

    if result.changed:
        delta = result.best_score - result.baseline_score
        direction = "+" if delta >= 0 else ""
        print(f"  Delta:          {direction}{delta:.3f}")

        # Show a unified diff summary
        print()
        print("  --- Diff (original → optimized) ---")
        orig_lines = result.original_instruction.splitlines(keepends=True)
        opt_lines = result.optimized_instruction.splitlines(keepends=True)
        diff = difflib.unified_diff(
            orig_lines, opt_lines,
            fromfile="original", tofile="optimized",
            lineterm="",
        )
        diff_lines = list(diff)
        if len(diff_lines) > 60:
            for line in diff_lines[:50]:
                print(f"  {line.rstrip()}")
            print(f"  ... ({len(diff_lines) - 50} more diff lines)")
        else:
            for line in diff_lines:
                print(f"  {line.rstrip()}")
    else:
        print("  Original prompt was already the best candidate.")

    # Always show the winning prompt
    print()
    print("  === Best Prompt ===")
    prompt_lines = result.optimized_instruction.split("\n")
    if len(prompt_lines) > 80:
        for line in prompt_lines[:70]:
            print(f"  | {line}")
        print(f"  | ... ({len(prompt_lines) - 70} more lines)")
    else:
        for line in prompt_lines:
            print(f"  | {line}")
    print("  === End Prompt ===")


def _score_baseline(
    module: SubagentModule | Any,
    examples: list[dspy.Example],
    metric: Any,
    is_subagent: bool = True,
) -> float:
    """Run the module with its original instruction and return the score."""
    scores = []
    for ex in examples:
        if is_subagent:
            pred = module.forward(
                task=ex.task,
                params=getattr(ex, "params", {}),
            )
        else:
            pred = module.forward(task=ex.task)
        scores.append(metric(ex, pred))
    return sum(scores) / len(scores) if scores else 0.0


def optimize_subagent(
    agent_id: str,
    trials: int = 20,
    num_candidates: int = 7,
    dry_run: bool = False,
) -> OptimizationResult | None:
    """Optimize a single subagent's system prompt.

    Always writes the best prompt back to the original file and archives
    the previous version.
    """
    examples = load_subagent_examples(agent_id)
    if not examples:
        print(f"  No scenarios for {agent_id}, skipping.")
        return None

    # Load the raw template (before rendering)
    md_path = SUBAGENTS_DIR / f"{agent_id}.md"
    content = md_path.read_text(encoding="utf-8")
    _, original_template = _parse_frontmatter(content)

    if dry_run:
        print(f"  Would optimize {agent_id}:")
        print(f"    Template length: {len(original_template)} chars")
        print(f"    Scenarios: {len(examples)}")
        print(f"    Trials: {trials}, Candidates: {num_candidates}")
        return OptimizationResult(
            agent_id=agent_id,
            original_instruction=original_template,
            optimized_instruction=original_template,
            best_score=0.0,
        )

    # Load config for tool filter and limits
    config = load_subagent_config(agent_id)
    client, model_id = get_bedrock_client()
    tool_executor = ToolMockDispatcher()

    # Create the DSPy module
    module = SubagentModule(
        agent_id=agent_id,
        bedrock_client=client,
        model_id=model_id,
        tool_executor=tool_executor,
        original_template=original_template,
        tool_filter=config.tool_filter,
        max_rounds=config.max_tool_rounds,
        max_tokens=config.max_tokens,
    )

    # Create the composite metric
    metric = make_composite_metric(original_template=original_template)

    # Score the baseline (original prompt) first
    print(f"  Scoring baseline for {agent_id}...")
    baseline_score = _score_baseline(module, examples, metric, is_subagent=True)
    print(f"  Baseline score: {baseline_score:.3f}")

    # Configure MIPROv2 in instruction-only mode
    optimizer = MIPROv2(
        metric=metric,
        auto=None,
        num_candidates=num_candidates,
        init_temperature=1.0,
        max_bootstrapped_demos=0,
        max_labeled_demos=0,
        num_threads=1,
        verbose=True,
    )

    print(f"  Running MIPROv2 for {agent_id} ({trials} trials)...")

    # MIPROv2 requires at least 2 training examples
    if len(examples) < 2:
        trainset = examples * 2
        valset = list(examples)
    else:
        trainset = examples
        valset = None

    compile_kwargs: dict = {
        "trainset": trainset,
        "num_trials": trials,
        "minibatch": len(trainset) > 3,
        "minibatch_size": min(len(trainset), 5),
    }
    if valset is not None:
        compile_kwargs["valset"] = valset

    optimized_module = optimizer.compile(module, **compile_kwargs)

    # Extract the optimized instruction
    optimized_instruction = str(
        optimized_module.predict.signature.instructions
    )

    # Score the best result
    best_score = 0.0
    for ex in examples:
        pred = optimized_module.forward(
            task=ex.task,
            params=getattr(ex, "params", {}),
        )
        score = metric(ex, pred)
        best_score = max(best_score, score)

    result = OptimizationResult(
        agent_id=agent_id,
        original_instruction=original_template,
        optimized_instruction=optimized_instruction,
        best_score=best_score,
        baseline_score=baseline_score,
        trials=trials,
    )

    # Show the result
    _print_prompt_result(result)

    # Only write back if the optimized prompt actually improved
    if result.changed and best_score > baseline_score:
        try:
            dest = write_optimized_subagent(
                agent_id, optimized_instruction,
                score=best_score, trials=trials,
                original_score=baseline_score,
            )
            print(f"\n  Updated {dest}")
            print(f"  Previous version archived to subagents/versions/{agent_id}/")
        except ValueError as e:
            print(f"\n  WARNING: {e}")
            print(f"  Prompt NOT updated — template variables would be lost.")
    elif result.changed:
        print(f"\n  Optimized prompt scored lower ({best_score:.3f}) than baseline ({baseline_score:.3f}). Keeping original.")
    else:
        print(f"\n  No changes to write for {agent_id}.")

    return result


def optimize_freeform(
    trials: int = 20,
    num_candidates: int = 7,
    dry_run: bool = False,
) -> OptimizationResult | None:
    """Optimize the freeform chat system prompt."""
    examples = load_freeform_examples()
    if not examples:
        print("  No live freeform scenarios found, skipping.")
        return None

    original_prompt = BASE_SYSTEM_PROMPT

    if dry_run:
        print("  Would optimize freeform chat prompt:")
        print(f"    Prompt length: {len(original_prompt)} chars")
        print(f"    Scenarios: {len(examples)}")
        print(f"    Trials: {trials}, Candidates: {num_candidates}")
        return OptimizationResult(
            agent_id="freeform",
            original_instruction=original_prompt,
            optimized_instruction=original_prompt,
            best_score=0.0,
        )

    client, model_id = get_bedrock_client()
    tool_executor = ToolMockDispatcher()

    module = FreeformChatModule(
        bedrock_client=client,
        model_id=model_id,
        tool_executor=tool_executor,
        base_prompt=original_prompt,
    )

    metric = make_composite_metric()

    # Score baseline
    print("  Scoring baseline for freeform...")
    baseline_score = _score_baseline(module, examples, metric, is_subagent=False)
    print(f"  Baseline score: {baseline_score:.3f}")

    optimizer = MIPROv2(
        metric=metric,
        auto=None,
        num_candidates=num_candidates,
        init_temperature=1.0,
        max_bootstrapped_demos=0,
        max_labeled_demos=0,
        num_threads=1,
        verbose=True,
    )

    print(f"  Running MIPROv2 for freeform chat ({trials} trials)...")

    if len(examples) < 2:
        trainset = examples * 2
        valset = list(examples)
    else:
        trainset = examples
        valset = None

    compile_kwargs: dict = {
        "trainset": trainset,
        "num_trials": trials,
        "minibatch": len(trainset) > 3,
        "minibatch_size": min(len(trainset), 5),
    }
    if valset is not None:
        compile_kwargs["valset"] = valset

    optimized_module = optimizer.compile(module, **compile_kwargs)

    optimized_instruction = str(
        optimized_module.predict.signature.instructions
    )

    best_score = 0.0
    for ex in examples:
        pred = optimized_module.forward(task=ex.task)
        score = metric(ex, pred)
        best_score = max(best_score, score)

    result = OptimizationResult(
        agent_id="freeform",
        original_instruction=original_prompt,
        optimized_instruction=optimized_instruction,
        best_score=best_score,
        baseline_score=baseline_score,
        trials=trials,
    )

    _print_prompt_result(result)

    if result.changed and best_score > baseline_score:
        try:
            dest = write_optimized_freeform(
                optimized_instruction,
                score=best_score, trials=trials,
                original_score=baseline_score,
            )
            print(f"\n  Updated {dest}")
            print(f"  Previous version archived to optimization/output/freeform_versions/")
        except Exception as e:
            print(f"\n  WARNING: Failed to write freeform prompt: {e}")
    elif result.changed:
        print(f"\n  Optimized prompt scored lower ({best_score:.3f}) than baseline ({baseline_score:.3f}). Keeping original.")
    else:
        print(f"\n  No changes to write for freeform.")

    return result


def optimize_all(
    trials: int = 20,
    num_candidates: int = 7,
    dry_run: bool = False,
) -> list[OptimizationResult]:
    """Optimize all subagent prompts and the freeform chat prompt."""
    if not dry_run:
        configure_dspy_lm()

    results: list[OptimizationResult] = []

    # Subagents
    agent_ids = list_subagent_ids()
    print(f"\nOptimizing {len(agent_ids)} subagents + freeform chat...")
    print("=" * 60)

    for agent_id in agent_ids:
        print(f"\n{'=' * 60}")
        print(f"[{agent_id}]")
        print("=" * 60)
        r = optimize_subagent(
            agent_id, trials=trials, num_candidates=num_candidates,
            dry_run=dry_run,
        )
        if r:
            results.append(r)

    # Freeform
    print(f"\n{'=' * 60}")
    print("[freeform]")
    print("=" * 60)
    r = optimize_freeform(
        trials=trials, num_candidates=num_candidates,
        dry_run=dry_run,
    )
    if r:
        results.append(r)

    # Summary
    print(f"\n{'=' * 60}")
    print("OPTIMIZATION SUMMARY")
    print("=" * 60)
    improved = [r for r in results if r.changed and r.best_score > r.baseline_score]
    regressed = [r for r in results if r.changed and r.best_score <= r.baseline_score]
    unchanged = [r for r in results if not r.changed]
    print(f"  Total prompts:  {len(results)}")
    print(f"  Updated:        {len(improved)}")
    print(f"  Skipped (no improvement): {len(regressed) + len(unchanged)}")
    print()
    print(f"  {'Agent':<30s} {'Status':<12s} {'Baseline':>8s} {'Best':>8s} {'Delta':>8s}")
    print(f"  {'-'*30} {'-'*12} {'-'*8} {'-'*8} {'-'*8}")
    for r in results:
        if dry_run:
            print(f"  {r.agent_id:<30s} {'dry-run':<12s}")
        else:
            delta = r.best_score - r.baseline_score
            delta_str = f"{'+' if delta >= 0 else ''}{delta:.3f}"
            if not r.changed:
                status = "unchanged"
            elif r.best_score > r.baseline_score:
                status = "UPDATED"
            else:
                status = "SKIPPED"
            print(
                f"  {r.agent_id:<30s} {status:<12s} "
                f"{r.baseline_score:>8.3f} {r.best_score:>8.3f} {delta_str:>8s}"
            )

    if improved:
        print()
        print("  Version history saved to subagents/versions/")

    return results
