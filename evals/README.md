# Teradata DBA Agent — Eval Suite

Multi-turn evaluation harness for the Teradata DBA Agent's system prompts and subagents. Uses [DeepEval](https://github.com/confident-ai/deepeval) for LLM-as-judge scoring and pytest for test orchestration. Includes a DSPy-based prompt optimization framework.

## What it tests

The eval suite validates **13 system prompts** (1 freeform chat + 12 subagents) across three tiers:

| Tier | What it does | LLM calls | Speed |
|------|-------------|-----------|-------|
| **Structural** | Validates prompt loading, template rendering, scenario data, tool filtering | None | < 1s |
| **Live** | Runs agents against LLM with mocked Teradata tools, checks output structure and content | Agent only | ~4 min |
| **LLM Judge** | Scores conversations with DeepEval metrics (quality, role adherence, task completion, etc.) | Agent + Judge | ~16 min |

## Architecture

```
Test Scenarios (JSON)
        |
        v
Conversation Runner (agent_runner.py / gemini_runner.py)
  - Loads system prompt from ../subagents/*.md
  - Calls Claude via Bedrock or Gemini via google-genai
  - Routes tool calls to mock dispatcher
        |
        v
DeepEval Metrics (custom_metrics.py)
  - LLM judge scores the full conversation
  - 7 metrics: quality, retention, completeness,
    tool use, role adherence, task completion, efficiency
        |
        v
Pass / Fail per metric threshold
```

### Key design decisions

- **Prompts are read directly** from `../subagents/*.md` — no duplication. The loader (`prompts/loader.py`) parses the same YAML frontmatter and Mustache-like templates as the app's `registry.ts`.
- **Tools are mocked** — the `ToolMockDispatcher` pattern-matches SQL queries against DBC view names (e.g., `DBC.QryLogV` -> fixture file) since the LLM varies exact SQL formatting between runs.
- **Agent runner is a Python port** of `src/main/ipc/chat.ts:runAgentLoop()` — same loop logic, non-streaming for eval efficiency.
- **Multi-provider** — supports both AWS Bedrock (Claude) and Google Gemini via the `EVAL_PROVIDER` env var. The `llm_client.py` factory routes to the correct backend.
- **Per-subagent judge config** — each subagent can have a `judge.json` with custom thresholds, criteria, and evaluation steps.

## Setup

```bash
cd evals
uv sync
```

### Environment variables

All variables can be placed in `evals/.env` — it is loaded automatically.

#### Provider selection

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_PROVIDER` | `bedrock` | LLM provider: `bedrock` or `gemini` |

#### Bedrock (Claude) — when `EVAL_PROVIDER=bedrock`

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | from AWS config | Bedrock auth |
| `AWS_SECRET_ACCESS_KEY` | from AWS config | Bedrock auth |
| `AWS_SESSION_TOKEN` | — | For assumed roles |
| `AWS_REGION` | `us-west-2` | Bedrock region |
| `AWS_ROLE_ARN` | — | Optional STS assume-role ARN |
| `EVAL_MODEL` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Model for agent under test |

#### Gemini — when `EVAL_PROVIDER=gemini`

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required.** Google API key |
| `EVAL_GEMINI_MODEL` | `gemini-2.5-flash` | Model for agent under test |

#### Judge model selection

The LLM judge scores agent conversations using DeepEval metrics. There are two layers of configuration — environment variables set the **session-wide default**, and per-subagent `judge.json` files can override **thresholds and evaluation criteria**.

**How the judge model is resolved (in order):**

1. `EVAL_JUDGE_MODEL` env var — if set, uses this model ID for the judge
2. Falls back to `EVAL_MODEL` (Bedrock) or `EVAL_GEMINI_MODEL` (Gemini) — the same model used for the agent under test

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_JUDGE_MODEL` | same as agent model | Override the judge model independently from the agent model |

The judge always uses the same provider as `EVAL_PROVIDER`. To use a different judge model than the agent under test (e.g., a stronger model for scoring), set `EVAL_JUDGE_MODEL` separately.

#### Per-subagent judge config (`judge.json`)

Each subagent can have a `subagents/{agent_id}/judge.json` that customizes **what the judge evaluates**, not which model it uses. The env vars above control model selection; `judge.json` controls scoring behavior.

```json
{
  "model": {
    "provider": "bedrock",
    "model_id": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "region": "us-west-2"
  },
  "metrics": {
    "conversation_quality": {
      "threshold": 0.7,
      "criteria": "Custom criteria for this subagent...",
      "evaluation_steps": ["Step 1...", "Step 2..."]
    },
    "task_completion": { "threshold": 0.7, "criteria": "..." },
    "trajectory_efficiency": { "threshold": 0.6, "criteria": "..." },
    "knowledge_retention": { "threshold": 0.7 },
    "completeness": { "threshold": 0.7 },
    "tool_use": { "threshold": 0.7 },
    "role_adherence": { "threshold": 0.7 }
  }
}
```

What `judge.json` controls per metric:
- **`threshold`** — minimum score to pass (overrides the default)
- **`criteria`** — custom evaluation criteria text (for ConversationalGEval metrics: conversation_quality, task_completion, trajectory_efficiency)
- **`evaluation_steps`** — custom scoring rubric steps (same three metrics)

The `model` block in `judge.json` is available for programmatic use but is **not used by the pytest test suite** — tests use the session-wide judge model from env vars. This means all subagents are judged by the same model during a test run, ensuring consistent scoring.

## Running tests

### Using run.sh (recommended)

```bash
# Structural smoke test — no LLM calls, instant
./run.sh --smoke -v

# Live agent tests — LLM calls with mocked tools
./run.sh --live -v

# LLM judge tests only — most expensive tier
./run.sh --judge -v

# Full suite — all tiers
./run.sh --full -v

# Full suite + quality gate report
./run.sh --gate -v --output gate_report.json

# Filter to a specific scenario
./run.sh --live -k "SA-HEALTH-001" -v

# Use Gemini instead of Bedrock
./run.sh --live --provider gemini -v

# Run DSPy prompt optimization
./run.sh --optimize
./run.sh --optimize -- --agent system-health --trials 10
```

### Using pytest directly

```bash
# Structural only — no LLM calls, instant
uv run pytest -m "eval and not live and not llm_judge" -v

# Live agent tests — real LLM calls, mocked tools
uv run pytest -m "eval and live and not llm_judge" -v

# Full suite including LLM judge scoring
uv run pytest -m eval -v --timeout=600

# Single subagent
uv run pytest scenarios/test_subagents.py -k "SA-HEALTH-001" -v

# Single freeform scenario
uv run pytest scenarios/test_freeform.py -k "FC-QA-001" -v
```

## Quality gate

The quality gate reads pytest JUnit XML output and produces an aggregate pass/fail decision:

```bash
# Run via run.sh (handles JUnit XML automatically)
./run.sh --gate --output gate_report.json

# Or run manually after a pytest --junitxml run
uv run pytest -m eval --junitxml=results.xml
uv run python quality_gate.py results.xml --output gate_report.json
```

### Gate criteria

| Criterion | Threshold | Description |
|-----------|-----------|-------------|
| structural_pass_rate | 100% | All structural tests must pass |
| live_pass_rate | 80% | 80% of live agent tests must pass |
| llm_judge_pass_rate | 70% | 70% of LLM judge tests must pass |
| overall_pass_rate | 80% | 80% of all tests must pass |

All criteria must pass for the gate to pass. Output is structured JSON:

```json
{
  "passed": true,
  "gates": {
    "structural_pass_rate": {"score": 1.0, "threshold": 1.0, "passed": true},
    "live_pass_rate": {"score": 0.92, "threshold": 0.8, "passed": true},
    ...
  },
  "summary": {"total": 148, "passed": 140, "failed": 8, "skipped": 1},
  "failing_tests": [...]
}
```

## Prompt optimization

The `optimization/` module uses [DSPy](https://dspy.ai/)'s MIPROv2 optimizer to systematically improve system prompts. It rewrites prompt instructions while preserving template variables and validates improvements against the eval suite.

### Running optimization

```bash
# Optimize all prompts (all subagents + freeform)
uv run python -m optimization.run_optimization

# Optimize a single subagent
uv run python -m optimization.run_optimization --agent system-health

# Optimize freeform chat only
uv run python -m optimization.run_optimization --freeform

# Custom trials and candidates
uv run python -m optimization.run_optimization --trials 30 --candidates 10

# Dry run — show what would be optimized without running
uv run python -m optimization.run_optimization --dry-run

# Optimize then validate with full eval suite
uv run python -m optimization.run_optimization --validate

# Via run.sh
./run.sh --optimize
./run.sh --optimize -- --agent security-audit --trials 10 --validate
```

### How it works

1. **Load scenarios** — reads eval scenario JSON files as DSPy training examples
2. **Score baseline** — runs the current prompt through the agent loop and scores with a composite metric (40% structural + 60% LLM judge)
3. **Optimize** — MIPROv2 rewrites the system prompt instruction across N trials, keeping template variables (`{{databaseName}}`, etc.) intact
4. **Compare** — only writes back if the optimized score exceeds the baseline
5. **Version** — archives the previous prompt to `subagents/{agent_id}/versions/v{N}.md` with metadata in `manifest.json`

### Safeguards

- Template variables (`{{variable}}`) must be preserved — enforced at write-time and as a guard in the composite metric
- Previous versions are archived with scores, timestamps, and trial counts for rollback
- Dry-run mode available for previewing changes without LLM calls

## Cost tracking

Token usage is tracked automatically during live and judge test runs. A summary prints at the end of each session:

```
==================================================
  Eval Cost Summary
==================================================
  API calls:      69
  Input tokens:   309,287
  Output tokens:  21,213
  Total tokens:   330,500
  Est. cost:      $1.2461
==================================================
```

Save cost data to JSON with: `EVAL_COST_OUTPUT=cost.json ./run.sh --live`

## Directory structure

```
evals/
  pyproject.toml              # Dependencies and pytest config
  conftest.py                 # Shared fixtures (LLM client, tool mocks, judge model)
  run.sh                      # Test runner script with mode selection
  cost_tracker.py             # Token usage and cost tracking
  quality_gate.py             # Aggregate pass/fail gate from JUnit XML

  prompts/
    loader.py                 # Parse subagent .md files, render templates
    freeform.py               # Freeform chat BASE_SYSTEM_PROMPT + builder

  tools/
    definitions.py            # 9 MCP tool schemas in Anthropic API format
    mocks.py                  # ToolMockDispatcher — SQL pattern matching to fixtures
    fixtures/                 # Canned Teradata responses (JSON)
      base_readQuery/         # Keyed by DBC view name (dbc_allspacev.json, etc.)
      base_tableDDL/          # Keyed by table name
      base_tableList/         # Keyed by database name
      base_columnDescription/ # Keyed by table name
      dba_tableSpace/         # Keyed by database name
      sec_userRoles/          # Keyed by username
      sec_userDbPermissions/  # Keyed by username
      sec_rolePermissions/    # Keyed by role name

  harness/
    llm_client.py             # Unified LLM client factory (routes to Bedrock or Gemini)
    agent_runner.py           # Port of runAgentLoop() — non-streaming (Bedrock/Claude)
    bedrock_client.py         # Bedrock auth wrapper
    gemini_client.py          # Gemini auth wrapper (google-genai SDK)
    gemini_runner.py          # Agent loop adapted for Gemini API
    deepeval_bridge.py        # Converts agent results to DeepEval test cases

  metrics/
    custom_metrics.py         # 7 metric factories configured for Teradata DBA domain

  scenarios/
    test_subagents.py         # Parametrized tests for subagents
    test_freeform.py          # Parametrized tests for freeform chat
    data/
      freeform_chat/          # Scenario JSON files for freeform chat
        basic_qa.json         # Scripted multi-turn Q&A
        tool_usage.json       # Live — agent explores a database
        subagent_suggestion.json  # Live — agent suggests a subagent

  optimization/
    run_optimization.py       # CLI entry point for DSPy optimization
    optimizer.py              # MIPROv2 orchestration and scoring
    dataset.py                # Loads eval scenarios as DSPy Examples
    dspy_lm.py                # Configures DSPy with Bedrock or Gemini backend
    dspy_metrics.py           # Bridges DeepEval metrics into DSPy-compatible callables
    dspy_modules.py           # DSPy modules wrapping the agent loop
    prompt_writer.py          # Writes optimized prompts back with version history

../subagents/
  {agent_id}/
    prompt.md                 # Subagent system prompt (read by eval loader)
    judge.json                # Per-subagent judge config (thresholds, criteria)
    evals/
      *.json                  # Scenario files for this subagent
    versions/
      v1.md, v2.md, ...      # Archived prompt versions from optimization
      manifest.json           # Version metadata (scores, timestamps)
```

**Note:** Subagent scenario files live alongside their prompts in `subagents/{agent_id}/evals/`, not inside the `evals/scenarios/` directory. Freeform chat scenarios are in `evals/scenarios/data/freeform_chat/`.

## Metrics

All 7 metrics use the configured LLM provider as the judge. Per-subagent overrides are supported via `judge.json`.

| Metric | Type | Threshold | What it measures |
|--------|------|-----------|-----------------|
| Conversation Quality | ConversationalGEval | 0.7 | Coherence, accuracy, helpfulness across turns |
| Knowledge Retention | KnowledgeRetentionMetric | 0.7 | Remembers facts from earlier in conversation |
| Conversation Completeness | ConversationCompletenessMetric | 0.7 | All user intents addressed |
| Tool Use Accuracy | ToolUseMetric | 0.7 | Right tools called with right arguments |
| Role Adherence | RoleAdherenceMetric | 0.7 | Stays in character as defined role |
| Task Completion | ConversationalGEval | 0.7 | Achieved the stated goal |
| Trajectory Efficiency | ConversationalGEval | 0.6 | No unnecessary steps or redundant calls |

## Adding a new scenario

### For a subagent

1. Create `subagents/<agent_id>/evals/<scenario-name>.json`:

```json
{
  "id": "SA-MYAGENT-001",
  "name": "My Agent — basic test",
  "agent_id": "my-agent",
  "params": {"databaseName": "PROD_DB"},
  "mode": "live",
  "scenario": "Description of what the agent should do.",
  "chatbot_role": "Role description for the agent.",
  "expected_outcome": "What a successful run looks like.",
  "success_criteria": {
    "task_completed": true,
    "required_tools": ["base_readQuery"],
    "forbidden_tools": [],
    "max_turns": 40,
    "must_mention": ["key", "terms"],
    "must_not_mention": ["DROP"]
  },
  "structural_checks": {
    "min_tool_calls": 3,
    "output_sections": ["Summary", "Findings"]
  }
}
```

2. Add any needed fixture files to `tools/fixtures/base_readQuery/` for DBC views the agent queries.

3. Run: `uv run pytest scenarios/test_subagents.py -k "SA-MYAGENT-001" -v`

### For freeform chat

1. Create `scenarios/data/freeform_chat/<name>.json` with either `"mode": "scripted"` (pre-written turns) or `"mode": "live"` (real agent calls with `initial_messages`).

2. Run: `uv run pytest scenarios/test_freeform.py -k "<scenario_id>" -v`

## Tool mock system

The `ToolMockDispatcher` routes tool calls to fixture files:

- **`base_readQuery`** — pattern-matches SQL against DBC view names using regex (e.g., `DBC.AllSpaceV` matches `dbc_allspacev.json`). This handles the LLM varying exact query formatting. 22 patterns are defined in `_SQL_PATTERNS`.
- **Other tools** — looks up fixtures by primary input key (e.g., `sec_userRoles` with `{"username": "admin"}` checks for `fixtures/sec_userRoles/admin.json`, falls back to `default.json`).
- **`td_syntax`** — returns static reference text.

To add a new fixture pattern for `base_readQuery`, add an entry to `_SQL_PATTERNS` in `tools/mocks.py` and create the corresponding JSON file.

## Cost

| Run type | Approximate cost |
|----------|-----------------|
| Structural only | $0 |
| Live tests (2 subagents + 2 freeform) | ~$0.05 |
| Full suite with LLM judge | ~$0.25 |
| Per additional subagent scenario | ~$0.03 (live) + ~$0.05 (judge) |
| DSPy optimization (20 trials, 1 agent) | ~$2-5 |
