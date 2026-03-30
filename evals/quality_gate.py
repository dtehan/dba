"""Quality gate — aggregate pass/fail decision across all eval results.

Reads pytest JUnit XML output and DeepEval metric scores to produce
a structured gate report with per-criterion pass/fail.

Usage:
    uv run python quality_gate.py results.xml [--output gate_report.json]
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from pathlib import Path


# ---------------------------------------------------------------------------
# Gate thresholds (from eval spec Section 5)
# ---------------------------------------------------------------------------

GATE_THRESHOLDS = {
    "structural_pass_rate": 1.0,       # All structural tests must pass
    "live_pass_rate": 0.80,            # 80% of live tests must pass
    "llm_judge_pass_rate": 0.70,       # 70% of LLM judge tests must pass
    "overall_pass_rate": 0.80,         # 80% of all tests must pass
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class GateCriterion:
    score: float
    threshold: float
    passed: bool
    details: str = ""


@dataclass
class GateReport:
    passed: bool
    gates: dict[str, GateCriterion] = field(default_factory=dict)
    summary: dict[str, int] = field(default_factory=dict)
    failing_tests: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "gates": {
                k: asdict(v) for k, v in self.gates.items()
            },
            "summary": self.summary,
            "failing_tests": self.failing_tests,
        }


# ---------------------------------------------------------------------------
# JUnit XML parser
# ---------------------------------------------------------------------------

@dataclass
class TestResult:
    name: str
    classname: str
    status: str  # "passed", "failed", "skipped", "error"
    time: float
    message: str = ""
    tier: str = ""  # "structural", "live", "llm_judge"


def parse_junit_xml(path: Path) -> list[TestResult]:
    """Parse pytest JUnit XML into TestResult objects."""
    tree = ET.parse(path)
    root = tree.getroot()

    results = []
    for suite in root.iter("testsuite"):
        for case in suite.iter("testcase"):
            name = case.get("name", "")
            classname = case.get("classname", "")
            time_val = float(case.get("time", "0"))

            failure = case.find("failure")
            error = case.find("error")
            skipped = case.find("skipped")

            if failure is not None:
                status = "failed"
                message = failure.get("message", "")
            elif error is not None:
                status = "error"
                message = error.get("message", "")
            elif skipped is not None:
                status = "skipped"
                message = skipped.get("message", "")
            else:
                status = "passed"
                message = ""

            # Classify tier from test class/marker names
            tier = _classify_tier(classname, name)

            results.append(TestResult(
                name=name,
                classname=classname,
                status=status,
                time=time_val,
                message=message,
                tier=tier,
            ))

    return results


def _classify_tier(classname: str, name: str) -> str:
    """Classify a test into structural/live/llm_judge tier."""
    lower = (classname + name).lower()
    if "llmjudge" in lower or "llm_judge" in lower:
        return "llm_judge"
    if "live" in lower:
        return "live"
    return "structural"


# ---------------------------------------------------------------------------
# Gate evaluation
# ---------------------------------------------------------------------------

def evaluate_gate(results: list[TestResult]) -> GateReport:
    """Evaluate quality gate criteria against test results."""
    # Filter out skipped tests
    active = [r for r in results if r.status != "skipped"]

    # Group by tier
    by_tier: dict[str, list[TestResult]] = {
        "structural": [],
        "live": [],
        "llm_judge": [],
    }
    for r in active:
        tier = by_tier.get(r.tier, by_tier["structural"])
        tier.append(r)

    # Calculate pass rates
    def pass_rate(tests: list[TestResult]) -> float:
        if not tests:
            return 1.0  # No tests = vacuously true
        passed = sum(1 for t in tests if t.status == "passed")
        return passed / len(tests)

    structural_rate = pass_rate(by_tier["structural"])
    live_rate = pass_rate(by_tier["live"])
    judge_rate = pass_rate(by_tier["llm_judge"])
    overall_rate = pass_rate(active)

    # Build gate criteria
    gates = {
        "structural_pass_rate": GateCriterion(
            score=round(structural_rate, 3),
            threshold=GATE_THRESHOLDS["structural_pass_rate"],
            passed=structural_rate >= GATE_THRESHOLDS["structural_pass_rate"],
            details=f"{sum(1 for t in by_tier['structural'] if t.status == 'passed')}/{len(by_tier['structural'])} structural tests passed",
        ),
        "live_pass_rate": GateCriterion(
            score=round(live_rate, 3),
            threshold=GATE_THRESHOLDS["live_pass_rate"],
            passed=live_rate >= GATE_THRESHOLDS["live_pass_rate"],
            details=f"{sum(1 for t in by_tier['live'] if t.status == 'passed')}/{len(by_tier['live'])} live tests passed",
        ),
        "llm_judge_pass_rate": GateCriterion(
            score=round(judge_rate, 3),
            threshold=GATE_THRESHOLDS["llm_judge_pass_rate"],
            passed=judge_rate >= GATE_THRESHOLDS["llm_judge_pass_rate"],
            details=f"{sum(1 for t in by_tier['llm_judge'] if t.status == 'passed')}/{len(by_tier['llm_judge'])} judge tests passed",
        ),
        "overall_pass_rate": GateCriterion(
            score=round(overall_rate, 3),
            threshold=GATE_THRESHOLDS["overall_pass_rate"],
            passed=overall_rate >= GATE_THRESHOLDS["overall_pass_rate"],
            details=f"{sum(1 for t in active if t.status == 'passed')}/{len(active)} total tests passed",
        ),
    }

    # Collect failing tests
    failing = [
        {
            "name": r.name,
            "classname": r.classname,
            "tier": r.tier,
            "message": r.message[:200] if r.message else "",
        }
        for r in active
        if r.status in ("failed", "error")
    ]

    # Overall gate passes only if ALL criteria pass
    all_passed = all(g.passed for g in gates.values())

    total = len(active)
    passed_count = sum(1 for t in active if t.status == "passed")
    failed_count = sum(1 for t in active if t.status == "failed")
    error_count = sum(1 for t in active if t.status == "error")
    skipped_count = sum(1 for t in results if t.status == "skipped")

    return GateReport(
        passed=all_passed,
        gates=gates,
        summary={
            "total": total,
            "passed": passed_count,
            "failed": failed_count,
            "errors": error_count,
            "skipped": skipped_count,
        },
        failing_tests=failing,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python quality_gate.py <junit_results.xml> [--output report.json]")
        sys.exit(1)

    xml_path = Path(sys.argv[1])
    if not xml_path.exists():
        print(f"Error: {xml_path} not found")
        sys.exit(1)

    output_path = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_path = Path(sys.argv[idx + 1])

    results = parse_junit_xml(xml_path)
    report = evaluate_gate(results)

    report_json = json.dumps(report.to_dict(), indent=2)

    if output_path:
        output_path.write_text(report_json)
        print(f"Gate report written to {output_path}")
    else:
        print(report_json)

    # Print summary
    status = "PASSED" if report.passed else "FAILED"
    print(f"\n{'='*60}")
    print(f"  Quality Gate: {status}")
    print(f"{'='*60}")
    for name, gate in report.gates.items():
        icon = "pass" if gate.passed else "FAIL"
        print(f"  [{icon}] {name}: {gate.score:.1%} (threshold: {gate.threshold:.0%}) — {gate.details}")

    if report.failing_tests:
        print(f"\n  Failing tests ({len(report.failing_tests)}):")
        for t in report.failing_tests[:10]:
            print(f"    - [{t['tier']}] {t['name']}: {t['message'][:80]}")

    sys.exit(0 if report.passed else 1)


if __name__ == "__main__":
    main()
