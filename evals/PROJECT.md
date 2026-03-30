# Eval Suite — Project Status

## What We Built

A Python-based multi-turn evaluation harness for the Teradata DBA Agent's 13 system prompts (1 freeform chat + 12 subagents). The harness reads prompts directly from the app's source files, runs agents against Bedrock with mocked Teradata tools, and scores conversations using DeepEval LLM-as-judge metrics.

### Core Components

| Component | File(s) | Status |
|-----------|---------|--------|
| **Prompt Loader** | `prompts/loader.py`, `prompts/freeform.py` | Complete — parses all 12 subagent `.md` files + freeform chat prompt |
| **Agent Runner** | `harness/agent_runner.py` | Complete — Python port of `runAgentLoop()` from `chat.ts`, non-streaming |
| **Bedrock Client** | `harness/bedrock_client.py` | Complete — env vars, `~/.aws/credentials`, or assume-role |
| **Tool Mock Dispatcher** | `tools/mocks.py` | Complete — SQL pattern matching on 22 DBC view patterns |
| **Tool Definitions** | `tools/definitions.py` | Complete — 9 MCP tools in Anthropic API format |
| **DeepEval Bridge** | `harness/deepeval_bridge.py` | Complete — converts agent results to `ConversationalTestCase` |
| **7 Metrics** | `metrics/custom_metrics.py` | Complete — all use `AmazonBedrockModel` as judge |
| **Quality Gate** | `quality_gate.py` | Complete — JUnit XML parsing, 4 gate criteria, JSON report |
| **Run Script** | `run.sh` | Complete — `--smoke`, `--live`, `--judge`, `--full`, `--gate` modes |
| **Cost Tracker** | `cost_tracker.py` | Complete — per-call token tracking, session summary |

### Test Coverage

**148 tests** across 3 tiers:

| Tier | Subagent Tests | Freeform Tests | Total | LLM Cost |
|------|---------------|----------------|-------|----------|
| Structural (no LLM) | 36 | 6 | 42 | $0 |
| Live (agent calls) | 48 | 4 | 52 | ~$0.50 |
| LLM Judge (agent + judge) | 48 | 6 | 54 | ~$2.00 |

**Scenarios:**
- 12 subagent scenarios (1 per agent) — all `mode: live`
- 3 freeform chat scenarios — 1 scripted Q&A, 2 live (tool usage, subagent suggestion)

### Fixture Data

22 `base_readQuery` fixture files covering all DBC system views referenced across the 12 subagents, plus fixtures for `sec_userRoles`, `sec_userDbPermissions`, `sec_rolePermissions`, `base_tableList`, `base_columnDescription`, `base_tableDDL`, and `dba_tableSpace`.

### Metrics

| Metric | DeepEval Type | Threshold |
|--------|--------------|-----------|
| Conversation Quality | ConversationalGEval | 0.7 |
| Knowledge Retention | KnowledgeRetentionMetric | 0.7 |
| Conversation Completeness | ConversationCompletenessMetric | 0.7 |
| Tool Use Accuracy | ToolUseMetric | 0.7 |
| Role Adherence | RoleAdherenceMetric | 0.7 |
| Task Completion | ConversationalGEval | 0.7 |
| Trajectory Efficiency | ConversationalGEval | 0.6 |

### Quality Gate Criteria

| Criterion | Threshold |
|-----------|-----------|
| Structural pass rate | 100% |
| Live pass rate | 80% |
| LLM judge pass rate | 70% |
| Overall pass rate | 80% |

### Eval Findings Surfaced So Far

- **Security Audit trajectory efficiency: 0.30/0.60** — the agent makes redundant `DBC.AllRightsV` queries. The prompt could consolidate its query strategy.
- **Freeform subagent suggestion: task completion 0.60/0.70** — the agent correctly delegates to the Security Audit subagent but could do a quick preliminary check before deferring.

---

## What Remains

### Phase 5: Simulated Mode

**User Simulator** — an LLM plays the user role, driving open-ended conversations with the agent. This tests behaviors that scripted and single-turn live modes can't reach:

- Can the agent ask good clarifying questions when the request is vague?
- Does it recover when a tool call fails or returns unexpected data?
- Does it stay on track across 10+ turn conversations?

Implementation:
- `harness/user_simulator.py` — LLM-powered user with a persona prompt and goal
- `scenarios/data/*/simulated_*.json` — goal-driven scenario format (no pre-written turns)
- Run each simulated scenario 3-5 times to measure consistency (mean, min, max, stddev)
- Use a cheaper model for the user simulator than the agent under test

### Additional Scripted Scenarios

Currently only 1 scripted scenario (freeform Q&A). More would be valuable for:

- **Error recovery** — tool returns an error, agent handles gracefully
- **Context retention** — user provides info in turn 1, agent must use it in turn 5+
- **Multi-intent** — user asks two things in one message
- **Incorrect premises** — user states something wrong, agent should correct
- **Role boundary** — user asks agent to do something outside its role (e.g., run DDL)

These are cheap to run (zero agent LLM calls — judge only) and ideal for regression testing.

### Regression Tracking

Store eval scores over time to detect prompt quality drift:

- Save metric scores per run to a JSON log file
- Compare current run to previous baseline
- Flag regressions (score dropped > 0.1 from baseline)
- Optional: chart scores over time

### CI Integration

The quality gate and run.sh are ready for CI. Remaining work:

- Add a GitHub Actions workflow that runs `./run.sh --smoke` on every PR (free, instant)
- Add a scheduled workflow that runs `./run.sh --gate` nightly or weekly
- Store gate reports as build artifacts
- Fail the PR check if structural tests regress

### Prompt Optimization Loop

Use eval findings to improve prompts, then re-run to verify improvement:

1. Run full eval suite, identify low-scoring scenarios
2. Edit the subagent `.md` prompt to address the finding
3. Re-run the specific scenario to verify the score improved
4. Run full suite to check for regressions

The Security Audit trajectory efficiency finding (0.30/0.60) is the first candidate for this loop.
