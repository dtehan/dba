# Teradata DBA Agent

## What This Is

A local desktop application that gives Teradata DBAs an AI-powered chat interface with specialized subagents for common DBA tasks. Users can have freeform conversations about their Teradata environment and launch prebuilt capabilities like security auditing, multi-value compression analysis, and statistics analysis — all powered by Claude. The UI carries Teradata's visual identity and brand feel.

## Core Value

DBAs can run expert-level analysis on their Teradata environment through natural conversation, getting actionable results from specialized subagents without writing complex queries manually.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Chat interface with Teradata look and feel (colors, typography, brand identity)
- [ ] Claude API integration for powering chat and subagents
- [ ] User-provided Teradata credentials via configuration
- [ ] Security Auditing subagent — analyzes database security posture and surfaces issues
- [ ] Multi-Value Compression (MVC) analysis subagent — evaluates compression opportunities
- [ ] Statistics analysis subagent — reviews and recommends table/column statistics
- [ ] Subagent results rendered as rich chat messages
- [ ] Ability to select and launch prebuilt subagents from the UI
- [ ] Freeform chat about Teradata environment and data

### Out of Scope

- Mobile app — desktop-first, local deployment
- Multi-user / shared hosting — runs on the DBA's own machine
- Service account connections — user credentials only
- Non-DBA audience — expert users assumed
- Downloadable reports / dashboards — chat-based output for v1

## Context

- Target users are experienced Teradata DBAs who know the platform well
- Teradata brand identity: orange (#F37440), dark charcoal (#1D1D1D), clean modern aesthetic
- Research phase will identify additional common DBA tasks beyond the initial three subagents
- Claude API (Anthropic) is the LLM backbone for all AI capabilities
- Local desktop app — no cloud deployment or shared infrastructure needed
- Subagents are specialized prompt chains that query Teradata and analyze results
- **Teradata MCP Servers** available for connectivity:
  - `tdsql-mcp` (github.com/ksturgeon-td/tdsql-mcp) — provides execute_query, list_databases, list_tables, describe_table, explain_query tools + 21 Teradata SQL syntax reference files
  - `teradata-mcp-server` (github.com/Teradata/teradata-mcp-server) — official Teradata community MCP server (Python)
  - These eliminate the need to build raw Teradata connectivity — subagents use MCP tools

## Constraints

- **LLM Provider**: Claude API (Anthropic) — chosen by user
- **Deployment**: Local application on DBA's machine — no server infrastructure
- **Connectivity**: Requires network access to both Teradata instance and Claude API
- **Brand**: UI must reflect Teradata visual identity (colors, feel, typography)
- **Tech Stack**: Open — research will guide framework selection

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude API as LLM backbone | User preference, strong tool-use capabilities | — Pending |
| Local desktop app | DBA workflows are local, avoids infrastructure complexity | — Pending |
| Chat-first output | Keeps v1 simple, results inline with conversation | — Pending |
| Teradata brand identity | Tool should feel native to the Teradata ecosystem | — Pending |
| Start with 3 subagents | Security, MVC, Statistics — validate pattern before expanding | — Pending |
| Use Teradata MCP servers | tdsql-mcp + teradata-mcp-server provide ready-made connectivity and SQL tools | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
