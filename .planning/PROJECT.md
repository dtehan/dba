# Teradata DBA Agent

## What This Is

A local Electron desktop application that gives Teradata DBAs an AI-powered chat interface with specialized analysis subagents. Users have freeform conversations about their Teradata environment and launch prebuilt capabilities — all powered by Claude via Bedrock. The UI carries Teradata's visual identity.

## Core Value

DBAs can run expert-level analysis on their Teradata environment through natural conversation, getting actionable results from specialized subagents without writing complex queries manually.

## Requirements

### Validated

- ✓ Chat interface with Teradata look and feel (colors, typography, brand identity) — v1.0
- ✓ Claude API integration for powering chat and subagents — v1.0
- ✓ User-provided Teradata credentials via configuration — v1.0
- ✓ Security Auditing subagent — analyzes database security posture and surfaces issues — v1.0
- ✓ Multi-Value Compression (MVC) analysis subagent — evaluates compression opportunities — v1.0
- ✓ Statistics analysis subagent — reviews and recommends table/column statistics — v1.0
- ✓ Subagent results rendered as rich chat messages — v1.0
- ✓ Ability to select and launch prebuilt subagents from the UI — v1.0
- ✓ Freeform chat about Teradata environment and data — v1.0
- ✓ Skew Analysis subagent — identifies data distribution skew and PI alternatives — v1.0
- ✓ Space Usage subagent — perm space utilization and capacity alerts — v1.0
- ✓ Redundancy Detection subagent — cross-database schema fingerprinting and data sampling to find redundant tables — post-v1.0
- ✓ Duplicate Detection subagent — exact row, business key, and fuzzy near-duplicate detection within a database — post-v1.0

### Active

(None yet — define for next milestone)

### Out of Scope

- Mobile app — desktop-first, local deployment
- Multi-user / shared hosting — runs on the DBA's own machine
- Service account connections — user credentials only
- Non-DBA audience — expert users assumed
- Downloadable reports / dashboards — chat-based output for v1
- DDL/DML execution from chat — catastrophic risk on production; SQL is copy-paste only
- Automated scheduling / cron — conflicts with local desktop model
- LLM-generated automated fixes with apply button — risk of unintended production changes

## Context

- Shipped v1.0 with 11,502 LOC TypeScript/TSX/CSS across 92 commits in 4 days
- Tech stack: Electron 41, React 19, TailwindCSS v4, shadcn/ui, Zustand, streamdown
- Claude via AWS Bedrock with AssumeRole + inference profiles (us-west-2)
- Teradata connectivity via MCP server (tdsql-mcp) spawned as child process
- 12 subagents: Security Audit, MVC Analysis, Statistics Analysis, Skew Analysis, Space Usage, Query Performance, Index Advisor, Lock Contention, System Health, Workload Management, Redundancy Detection, Duplicate Detection
- Subagent pattern: markdown definition file + tool-use loop + non-streaming messages.create
- Brand identity: Teradata orange (#F37440), dark charcoal (#1D1D1D), clean modern aesthetic
- Target users are experienced Teradata DBAs who know the platform well

## Constraints

- **LLM Provider**: Claude via AWS Bedrock — AssumeRole with inference profiles
- **Deployment**: Local application on DBA's machine — no server infrastructure
- **Connectivity**: Requires network access to both Teradata instance and Bedrock endpoint
- **Brand**: UI must reflect Teradata visual identity (colors, feel, typography)
- **Tech Stack**: Electron 41 + React 19 + TypeScript + electron-vite 5.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude via Bedrock (not direct API) | Enterprise auth via AssumeRole, no API key management | ✓ Good |
| Local desktop app | DBA workflows are local, avoids infrastructure complexity | ✓ Good |
| Chat-first output | Keeps v1 simple, results inline with conversation | ✓ Good |
| Teradata brand identity | Tool should feel native to the Teradata ecosystem | ✓ Good |
| Start with 3 subagents, expanded to 12 | Security, MVC, Statistics validated pattern; additional agents followed naturally | ✓ Good |
| MCP server for Teradata connectivity | tdsql-mcp provides ready-made query/schema tools, no raw driver needed | ✓ Good |
| Markdown-based subagent definitions | Convention-based discovery, system prompts as .md files in subagents/ | ✓ Good |
| Non-streaming subagent execution | Complete report collected then rendered; avoids partial analysis display | ✓ Good |
| safeStorage for credentials | OS keychain integration, no plaintext, no extra dependencies | ✓ Good |
| Streamdown for chat rendering | Handles incomplete markdown during streaming without layout thrashing | ✓ Good |

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
*Last updated: 2026-03-27 after v1.0 milestone*
