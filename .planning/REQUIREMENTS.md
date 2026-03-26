# Requirements: Teradata DBA Agent

**Defined:** 2026-03-24
**Core Value:** DBAs can run expert-level analysis on their Teradata environment through natural conversation, getting actionable results from specialized subagents

## v1 Requirements

### Foundation

- [x] **FOUN-01**: App launches as a local Electron desktop application
- [x] **FOUN-02**: User can configure Teradata connection credentials (host, username, password)
- [x] **FOUN-03**: Credentials are stored securely via OS keychain (Electron safeStorage)
- [x] **FOUN-04**: App connects to Teradata via MCP server (tdsql-mcp / teradata-mcp-server)
- [x] **FOUN-05**: App connects to Claude API with user-provided API key
- [x] **FOUN-06**: Connection health indicator shows Teradata and Claude API status

### Chat

- [x] **CHAT-01**: User can send freeform messages and receive Claude-powered responses
- [x] **CHAT-02**: Chat responses stream in real-time (not wait-for-complete)
- [x] **CHAT-03**: Chat has access to Teradata schema context (databases, tables, columns) via MCP
- [x] **CHAT-04**: Session memory — follow-up questions retain conversation context
- [x] **CHAT-05**: Rich formatted output — markdown tables, code blocks, summaries rendered in chat
- [x] **CHAT-06**: User can translate natural language to Teradata SQL via chat

### Subagents

- [x] **AGEN-01**: User can browse and launch prebuilt subagents from a launcher UI
- [x] **AGEN-02**: Subagent results appear as rich formatted messages in the chat thread
- [x] **AGEN-03**: Subagents run in isolated context (don't pollute main chat history)
- [x] **AGEN-04**: Subagent output includes actionable recommendations, not just raw data
- [x] **AGEN-05**: SQL recommendations are surfaced for copy-paste — never auto-executed

### Security Auditing Subagent

- [x] **SECU-01**: User can run a security audit on a database or the full system
- [x] **SECU-02**: Audit analyzes access rights, roles, and role membership
- [x] **SECU-03**: Audit identifies overly permissive grants and orphaned access
- [x] **SECU-04**: Audit reviews logon/logoff activity for anomalies
- [x] **SECU-05**: Audit produces a prioritized findings summary with remediation steps

### MVC Analysis Subagent

- [x] **MVCA-01**: User can run MVC analysis on a database or specific tables
- [x] **MVCA-02**: Analysis identifies columns that are strong candidates for multi-value compression
- [x] **MVCA-03**: Analysis estimates space savings from recommended compressions
- [x] **MVCA-04**: Analysis produces ALTER TABLE statements for copy-paste application
- [x] **MVCA-05**: Analysis prioritizes recommendations by space savings impact

### Statistics Analysis Subagent

- [x] **STAT-01**: User can run statistics analysis on a database or specific tables
- [x] **STAT-02**: Analysis identifies missing statistics on indexed and frequently joined columns
- [x] **STAT-03**: Analysis identifies stale statistics that need recollection
- [x] **STAT-04**: Analysis produces COLLECT STATISTICS statements for copy-paste application
- [x] **STAT-05**: Analysis prioritizes recommendations by query plan impact

### Skew Analysis Subagent

- [x] **SKEW-01**: User can run skew analysis on a database or specific tables
- [x] **SKEW-02**: Analysis identifies tables with significant data distribution skew
- [x] **SKEW-03**: Analysis explains the cause of skew (PI choice, data patterns)
- [x] **SKEW-04**: Analysis suggests primary index alternatives to reduce skew
- [x] **SKEW-05**: Analysis ranks tables by skew severity

### Space Usage Subagent

- [x] **SPAC-01**: User can run space analysis on a database or the full system
- [x] **SPAC-02**: Analysis shows current perm space usage vs allocation per database
- [x] **SPAC-03**: Analysis identifies databases approaching space limits
- [x] **SPAC-04**: Analysis surfaces the largest tables consuming space
- [x] **SPAC-05**: Analysis provides recommendations for space recovery

### UI & Branding

- [x] **UIBR-01**: UI uses Teradata brand colors (orange #F37440, dark charcoal #1D1D1D)
- [x] **UIBR-02**: UI has a clean, modern aesthetic consistent with Teradata product family
- [x] **UIBR-03**: Chat interface has a sidebar with subagent launcher
- [x] **UIBR-04**: Responsive layout that works well on typical DBA monitor sizes

## v2 Requirements

### Additional Subagents

- **DBQL-01**: DBQL log analysis — surface top resource consumers and bad SQL patterns
- **QPRF-01**: Query performance / EXPLAIN analysis — explain plans in natural language
- **WKLD-01**: Workload management review — TASM configuration analysis

### Enhanced Features

- **EXPR-01**: Export findings to file (CSV, JSON)
- **HIST-01**: Persistent conversation history across sessions
- **MULT-01**: Multi-connection support (dev/test/prod switching)

## Out of Scope

| Feature | Reason |
|---------|--------|
| DDL/DML execution from chat | Catastrophic risk if Claude misunderstands intent on production; SQL surfaced for copy-paste only |
| Automated scheduling / cron | Conflicts with local desktop model; requires background service infrastructure |
| PDF report export | Adds significant UI complexity for v1; chat output is shareable via copy-paste |
| Live streaming metrics dashboard | Competes with Viewpoint rather than complementing it; requires persistent polling |
| LLM-generated automated fixes with apply button | Risk of unintended changes to production; hallucinated fixes are dangerous |
| Multi-system simultaneous connections | Multiplies complexity and security risk; single connection per session |
| Mobile app | Desktop-first for DBA workflows |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| FOUN-05 | Phase 1 | Complete |
| FOUN-06 | Phase 1 | Complete |
| UIBR-01 | Phase 1 | Complete |
| UIBR-02 | Phase 1 | Complete |
| UIBR-04 | Phase 1 | Complete |
| CHAT-01 | Phase 2 | Complete |
| CHAT-02 | Phase 2 | Complete |
| CHAT-03 | Phase 2 | Complete |
| CHAT-04 | Phase 2 | Complete |
| CHAT-05 | Phase 2 | Complete |
| CHAT-06 | Phase 2 | Complete |
| AGEN-01 | Phase 2 | Complete |
| AGEN-02 | Phase 2 | Complete |
| AGEN-03 | Phase 2 | Complete |
| AGEN-04 | Phase 2 | Complete |
| AGEN-05 | Phase 2 | Complete |
| UIBR-03 | Phase 2 | Complete |
| SECU-01 | Phase 3 | Complete |
| SECU-02 | Phase 3 | Complete |
| SECU-03 | Phase 3 | Complete |
| SECU-04 | Phase 3 | Complete |
| SECU-05 | Phase 3 | Complete |
| MVCA-01 | Phase 3 | Complete |
| MVCA-02 | Phase 3 | Complete |
| MVCA-03 | Phase 3 | Complete |
| MVCA-04 | Phase 3 | Complete |
| MVCA-05 | Phase 3 | Complete |
| STAT-01 | Phase 3 | Complete |
| STAT-02 | Phase 3 | Complete |
| STAT-03 | Phase 3 | Complete |
| STAT-04 | Phase 3 | Complete |
| STAT-05 | Phase 3 | Complete |
| SKEW-01 | Phase 4 | Complete |
| SKEW-02 | Phase 4 | Complete |
| SKEW-03 | Phase 4 | Complete |
| SKEW-04 | Phase 4 | Complete |
| SKEW-05 | Phase 4 | Complete |
| SPAC-01 | Phase 4 | Complete |
| SPAC-02 | Phase 4 | Complete |
| SPAC-03 | Phase 4 | Complete |
| SPAC-04 | Phase 4 | Complete |
| SPAC-05 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
