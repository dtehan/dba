# Teradata DBA Agent — Eval Suite

Multi-turn evaluation harness for the Teradata DBA Agent's system prompts and subagents. Uses [DeepEval](https://github.com/confident-ai/deepeval) for LLM-as-judge scoring and pytest for test orchestration.

## What it tests

The eval suite validates **13 system prompts** (1 freeform chat + 12 subagents) across three tiers:

| Tier | What it does | LLM calls | Speed |
|------|-------------|-----------|-------|
| **Structural** | Validates prompt loading, template rendering, scenario data, tool filtering | None | < 1s |
| **Live** | Runs agents against Bedrock with mocked Teradata tools, checks output structure and content | Agent only | ~4 min |
| **LLM Judge** | Scores conversations with DeepEval metrics (quality, role adherence, task completion, etc.) | Agent + Judge | ~16 min |

## Architecture

```
Test Scenarios (JSON)
        |
        v
Conversation Runner (agent_runner.py)
  - Loads system prompt from ../subagents/*.md
  - Calls Claude via Bedrock
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

## Setup

```bash
cd evals
uv sync
```

### Environment variables

The eval suite uses the same AWS credentials as your Bedrock access. It reads from `~/.aws/credentials`, env vars, or IAM roles — whichever is configured.

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | from AWS config | Bedrock auth |
| `AWS_SECRET_ACCESS_KEY` | from AWS config | Bedrock auth |
| `AWS_SESSION_TOKEN` | — | For assumed roles |
| `AWS_REGION` | `us-west-2` | Bedrock region |
| `AWS_ROLE_ARN` | — | Optional assume-role |
| `EVAL_MODEL` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Model for agent under test |
| `EVAL_JUDGE_MODEL` | same as `EVAL_MODEL` | Model for LLM judge scoring |

## Running tests

### Using run.sh (recommended)

```bash
# Structural smoke test — no LLM calls, instant
./run.sh --smoke -v

# Live agent tests — Bedrock calls with mocked tools
./run.sh --live -v

# LLM judge tests only — most expensive tier
./run.sh --judge -v

# Full suite — all tiers
./run.sh --full -v

# Full suite + quality gate report
./run.sh --gate -v --output gate_report.json

# Filter to a specific scenario
./run.sh --live -k "SA-HEALTH-001" -v
```

### Using pytest directly

```bash
# Structural only — no LLM calls, instant
uv run pytest -m "eval and not live and not llm_judge" -v

# Live agent tests — real Bedrock calls, mocked tools
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
  conftest.py                 # Shared fixtures (bedrock client, tool mocks, judge model)

  prompts/
    loader.py                 # Parse subagent .md files, render templates
    freeform.py               # Freeform chat BASE_SYSTEM_PROMPT + builder

  tools/
    definitions.py            # 9 MCP tool schemas in Anthropic API format
    mocks.py                  # ToolMockDispatcher — SQL pattern matching to fixtures
    fixtures/                 # Canned Teradata responses (JSON)
      base_readQuery/         # Keyed by DBC view name (dbc_allspacev.json, etc.)
      sec_userRoles/          # Keyed by username
      sec_userDbPermissions/
      sec_rolePermissions/
      base_tableList/
      base_columnDescription/

  harness/
    agent_runner.py           # Port of runAgentLoop() — non-streaming
    bedrock_client.py         # Bedrock auth wrapper
    deepeval_bridge.py        # Converts agent results to DeepEval test cases

  metrics/
    custom_metrics.py         # 7 metric factories configured for Teradata DBA domain

  scenarios/
    data/
      subagents/              # Scenario JSON files per subagent
        system_health.json
        security_audit.json
      freeform_chat/          # Scenario JSON files for freeform chat
        basic_qa.json         # Scripted multi-turn Q&A
        tool_usage.json       # Live — agent explores a database
        subagent_suggestion.json  # Live — agent suggests a subagent
    test_subagents.py         # Parametrized tests for subagents
    test_freeform.py          # Parametrized tests for freeform chat
```

## Metrics

All 7 metrics use Claude via Bedrock as the LLM judge.

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

1. Create `scenarios/data/subagents/<agent_id>.json`:

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

- **`base_readQuery`** — pattern-matches SQL against DBC view names using regex (e.g., `DBC.AllSpaceV` matches `dbc_allspacev.json`). This handles the LLM varying exact query formatting.
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
