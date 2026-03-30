#!/usr/bin/env bash
#
# Teradata DBA Agent — Eval Runner
#
# Usage:
#   ./run.sh              # Default: structural tests only
#   ./run.sh --smoke      # Structural tests (no LLM calls, instant)
#   ./run.sh --live       # Live agent tests (Bedrock calls, mocked tools)
#   ./run.sh --judge      # LLM judge tests only (expensive)
#   ./run.sh --full       # All tiers (structural + live + judge)
#   ./run.sh --gate       # Full run + quality gate report
#
# Options:
#   -k PATTERN            # pytest -k filter (e.g., -k "SA-HEALTH-001")
#   -v                    # Verbose output
#   --timeout N           # Override timeout in seconds (default: 600)
#   --output FILE         # Quality gate report output path
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults
MODE="smoke"
PYTEST_ARGS=()
VERBOSE=""
TIMEOUT=600
GATE_OUTPUT=""
EXTRA_K=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --smoke)    MODE="smoke"; shift ;;
        --live)     MODE="live"; shift ;;
        --judge)    MODE="judge"; shift ;;
        --full)     MODE="full"; shift ;;
        --gate)     MODE="gate"; shift ;;
        -v)         VERBOSE="-v"; shift ;;
        -k)         EXTRA_K="$2"; shift 2 ;;
        --timeout)  TIMEOUT="$2"; shift 2 ;;
        --output)   GATE_OUTPUT="$2"; shift 2 ;;
        *)          PYTEST_ARGS+=("$1"); shift ;;
    esac
done

# Build pytest marker expression
case "$MODE" in
    smoke)
        MARKERS="eval and not live and not llm_judge"
        echo "Running structural tests (no LLM calls)..."
        ;;
    live)
        MARKERS="eval and live and not llm_judge"
        echo "Running live agent tests (Bedrock + mocked tools)..."
        ;;
    judge)
        MARKERS="eval and llm_judge"
        echo "Running LLM judge tests (most expensive)..."
        ;;
    full|gate)
        MARKERS="eval"
        echo "Running full eval suite (all tiers)..."
        ;;
esac

# Build pytest command
CMD=(uv run pytest -m "$MARKERS" --timeout="$TIMEOUT")

if [[ -n "$VERBOSE" ]]; then
    CMD+=("-v")
fi

if [[ -n "$EXTRA_K" ]]; then
    CMD+=("-k" "$EXTRA_K")
fi

# For gate mode, output JUnit XML
JUNIT_XML=""
if [[ "$MODE" == "gate" ]]; then
    JUNIT_XML="$(mktemp /tmp/eval_results_XXXXXX.xml)"
    CMD+=("--junitxml=$JUNIT_XML")
fi

if [[ ${#PYTEST_ARGS[@]} -gt 0 ]]; then
    CMD+=("${PYTEST_ARGS[@]}")
fi

# Run tests
echo "Command: ${CMD[*]}"
echo ""

set +e
"${CMD[@]}"
TEST_EXIT=$?
set -e

# Quality gate
if [[ "$MODE" == "gate" && -f "$JUNIT_XML" ]]; then
    echo ""
    echo "Running quality gate..."

    GATE_CMD=(uv run python quality_gate.py "$JUNIT_XML")
    if [[ -n "$GATE_OUTPUT" ]]; then
        GATE_CMD+=(--output "$GATE_OUTPUT")
    fi

    "${GATE_CMD[@]}"
    GATE_EXIT=$?

    rm -f "$JUNIT_XML"
    exit $GATE_EXIT
fi

exit $TEST_EXIT
