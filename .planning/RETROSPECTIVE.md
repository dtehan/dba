# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-27
**Phases:** 4 | **Plans:** 17 | **Commits:** 92

### What Was Built
- Electron 41 desktop app with Teradata brand identity, secure credential storage via OS keychain
- Streaming freeform chat with MCP-powered Teradata schema context (databases, tables, columns)
- Subagent framework with convention-based markdown discovery, categorized launcher, parameter forms
- Security Audit subagent — DBC view analysis, prioritized findings with remediation SQL
- MVC Analysis subagent — Package Bit-Cost Model algorithm with 100-round tool-use loop
- Statistics Analysis subagent — missing/stale stats detection with COLLECT STATISTICS output
- Skew Analysis subagent — per-AMP distribution pipeline with PI alternative suggestions
- Space Usage subagent — perm space utilization with 80%/95% capacity alerting

### What Worked
- Markdown-based subagent definitions enabled rapid subagent creation (Phases 3-4 subagents were fast to ship once the pattern was established)
- MCP server for Teradata connectivity eliminated all raw driver work — subagents just call tools
- Non-streaming subagent execution simplified error handling and result rendering
- TailwindCSS v4 Vite plugin eliminated PostCSS config complexity entirely
- shadcn/ui copy-owned components made Teradata branding straightforward
- Encoding domain algorithms (Package Bit-Cost Model) entirely in system prompts kept app code minimal

### What Was Inefficient
- TailwindCSS v4 @theme custom spacing tokens didn't work reliably — had to fall back to inline styles in some places
- shadcn/ui CLI wrote to literal `@/` path requiring manual copy after each `npx shadcn add`
- Phase 3 visual checkpoint (03-05) was light — converted inline styles to Tailwind but didn't catch all UI issues
- Some summary files had extraction artifacts (Rule 2 missing notes leaked into one-liners)

### Patterns Established
- Subagent definition pattern: markdown file in `src/main/subagents/` with system prompt, tool filter, and config
- IPC security pattern: credentials never cross to renderer, decrypt only in main process services
- Schema context injection: MCP tool calls → markdown format → 4K character budget → system prompt
- Tool-use loop pattern: configurable MAX_TOOL_ROUNDS per subagent complexity (20 for simple, 100 for MVC)
- Bedrock client as shared service with AssumeRole + inference profiles

### Key Lessons
1. Convention-based subagent discovery (scan markdown files) scales better than registry objects — adding a new subagent is just adding a .md file
2. Encoding complex domain algorithms in system prompts (not app code) lets the LLM execute the analysis directly via tools, reducing TypeScript complexity dramatically
3. MCP servers as the Teradata connectivity layer means subagents don't need to know about connection details at all
4. Non-streaming for subagents was the right call — partial analysis reports are confusing to users

### Cost Observations
- Model mix: primarily opus for planning/execution, sonnet for research
- Sessions: ~8 across 4 days
- Notable: Phase 4 was fastest (2 plans, markdown-only subagent definitions) because the pattern was fully established

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 92 | 4 | Initial build — established subagent pattern |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons to be verified in subsequent milestones)
