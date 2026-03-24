# Requirements: Teradata DBA Agent

**Defined:** 2026-03-24
**Core Value:** DBAs can run expert-level analysis on their Teradata environment through natural conversation, getting actionable results from specialized subagents

## v1 Requirements

### Foundation

- [ ] **FOUN-01**: App launches as a local Electron desktop application
- [ ] **FOUN-02**: User can configure Teradata connection credentials (host, username, password)
- [ ] **FOUN-03**: Credentials are stored securely via OS keychain (Electron safeStorage)
- [ ] **FOUN-04**: App connects to Teradata via MCP server (tdsql-mcp / teradata-mcp-server)
- [ ] **FOUN-05**: App connects to Claude API with user-provided API key
- [ ] **FOUN-06**: Connection health indicator shows Teradata and Claude API status

### Chat

- [ ] **CHAT-01**: User can send freeform messages and receive Claude-powered responses
- [ ] **CHAT-02**: Chat responses stream in real-time (not wait-for-complete)
- [ ] **CHAT-03**: Chat has access to Teradata schema context (databases, tables, columns) via MCP
- [ ] **CHAT-04**: Session memory — follow-up questions retain conversation context
- [ ] **CHAT-05**: Rich formatted output — markdown tables, code blocks, summaries rendered in chat
- [ ] **CHAT-06**: User can translate natural language to Teradata SQL via chat

### Subagents

- [ ] **AGEN-01**: User can browse and launch prebuilt subagents from a launcher UI
- [ ] **AGEN-02**: Subagent results appear as rich formatted messages in the chat thread
- [ ] **AGEN-03**: Subagents run in isolated context (don't pollute main chat history)
- [ ] **AGEN-04**: Subagent output includes actionable recommendations, not just raw data
- [ ] **AGEN-05**: SQL recommendations are surfaced for copy-paste — never auto-executed

### Security Auditing Subagent

- [ ] **SECU-01**: User can run a security audit on a database or the full system
- [ ] **SECU-02**: Audit analyzes access rights, roles, and role membership
- [ ] **SECU-03**: Audit identifies overly permissive grants and orphaned access
- [ ] **SECU-04**: Audit reviews logon/logoff activity for anomalies
- [ ] **SECU-05**: Audit produces a prioritized findings summary with remediation steps

### MVC Analysis Subagent

- [ ] **MVCA-01**: User can run MVC analysis on a database or specific tables
- [ ] **MVCA-02**: Analysis identifies columns that are strong candidates for multi-value compression
- [ ] **MVCA-03**: Analysis estimates space savings from recommended compressions
- [ ] **MVCA-04**: Analysis produces ALTER TABLE statements for copy-paste application
- [ ] **MVCA-05**: Analysis prioritizes recommendations by space savings impact

### Statistics Analysis Subagent

- [ ] **STAT-01**: User can run statistics analysis on a database or specific tables
- [ ] **STAT-02**: Analysis identifies missing statistics on indexed and frequently joined columns
- [ ] **STAT-03**: Analysis identifies stale statistics that need recollection
- [ ] **STAT-04**: Analysis produces COLLECT STATISTICS statements for copy-paste application
- [ ] **STAT-05**: Analysis prioritizes recommendations by query plan impact

### Skew Analysis Subagent

- [ ] **SKEW-01**: User can run skew analysis on a database or specific tables
- [ ] **SKEW-02**: Analysis identifies tables with significant data distribution skew
- [ ] **SKEW-03**: Analysis explains the cause of skew (PI choice, data patterns)
- [ ] **SKEW-04**: Analysis suggests primary index alternatives to reduce skew
- [ ] **SKEW-05**: Analysis ranks tables by skew severity

### Space Usage Subagent

- [ ] **SPAC-01**: User can run space analysis on a database or the full system
- [ ] **SPAC-02**: Analysis shows current perm space usage vs allocation per database
- [ ] **SPAC-03**: Analysis identifies databases approaching space limits
- [ ] **SPAC-04**: Analysis surfaces the largest tables consuming space
- [ ] **SPAC-05**: Analysis provides recommendations for space recovery

### UI & Branding

- [ ] **UIBR-01**: UI uses Teradata brand colors (orange #F37440, dark charcoal #1D1D1D)
- [ ] **UIBR-02**: UI has a clean, modern aesthetic consistent with Teradata product family
- [ ] **UIBR-03**: Chat interface has a sidebar with subagent launcher
- [ ] **UIBR-04**: Responsive layout that works well on typical DBA monitor sizes

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
| FOUN-01 | Phase 1 | Pending |
| FOUN-02 | Phase 1 | Pending |
| FOUN-03 | Phase 1 | Pending |
| FOUN-04 | Phase 1 | Pending |
| FOUN-05 | Phase 1 | Pending |
| FOUN-06 | Phase 1 | Pending |
| UIBR-01 | Phase 1 | Pending |
| UIBR-02 | Phase 1 | Pending |
| UIBR-04 | Phase 1 | Pending |
| CHAT-01 | Phase 2 | Pending |
| CHAT-02 | Phase 2 | Pending |
| CHAT-03 | Phase 2 | Pending |
| CHAT-04 | Phase 2 | Pending |
| CHAT-05 | Phase 2 | Pending |
| CHAT-06 | Phase 2 | Pending |
| AGEN-01 | Phase 2 | Pending |
| AGEN-02 | Phase 2 | Pending |
| AGEN-03 | Phase 2 | Pending |
| AGEN-04 | Phase 2 | Pending |
| AGEN-05 | Phase 2 | Pending |
| UIBR-03 | Phase 2 | Pending |
| SECU-01 | Phase 3 | Pending |
| SECU-02 | Phase 3 | Pending |
| SECU-03 | Phase 3 | Pending |
| SECU-04 | Phase 3 | Pending |
| SECU-05 | Phase 3 | Pending |
| MVCA-01 | Phase 3 | Pending |
| MVCA-02 | Phase 3 | Pending |
| MVCA-03 | Phase 3 | Pending |
| MVCA-04 | Phase 3 | Pending |
| MVCA-05 | Phase 3 | Pending |
| STAT-01 | Phase 3 | Pending |
| STAT-02 | Phase 3 | Pending |
| STAT-03 | Phase 3 | Pending |
| STAT-04 | Phase 3 | Pending |
| STAT-05 | Phase 3 | Pending |
| SKEW-01 | Phase 4 | Pending |
| SKEW-02 | Phase 4 | Pending |
| SKEW-03 | Phase 4 | Pending |
| SKEW-04 | Phase 4 | Pending |
| SKEW-05 | Phase 4 | Pending |
| SPAC-01 | Phase 4 | Pending |
| SPAC-02 | Phase 4 | Pending |
| SPAC-03 | Phase 4 | Pending |
| SPAC-04 | Phase 4 | Pending |
| SPAC-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
