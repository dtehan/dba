# Feature Research

**Domain:** AI-Powered Teradata DBA Agent (local desktop chat tool)
**Researched:** 2026-03-24
**Confidence:** MEDIUM — Teradata DBA task landscape is well-documented. AI DBA assistant comparators are sparse (most are Oracle/SQL Server-focused). Feature recommendations synthesized from Teradata docs, community forums, and analogous AI DBA tools.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a Teradata DBA will assume exist. Missing any of these makes the tool feel unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Freeform chat about the Teradata environment | Core AI assistant promise — users expect to ask anything | MEDIUM | Requires Claude API integration with Teradata query context |
| Prebuilt subagent launcher (Security, MVC, Statistics) | The reason they installed the tool | LOW | UI selection mechanism; the subagents themselves are the work |
| Security Auditing subagent | DBAs regularly review access rights, roles, and logon failures; manual DBC queries are tedious | HIGH | Queries DBC.AccessRights, DBC.RoleMembers, DBC.AccLogTbl, DBC.LogOnOffV |
| Multi-Value Compression (MVC) analysis subagent | MVC tuning is a high-ROI, time-consuming task DBAs defer without tooling | HIGH | Queries DBC.TableSizeV, columnar analysis for compression candidates |
| Statistics analysis subagent | Stale stats are the #1 cause of bad query plans; this check is mandatory and repetitive | HIGH | Queries DBC.StatsTbl, DBC.Columns, identifies missing/stale stats |
| Rich formatted output in chat | Raw SQL output from subagents is useless; structured findings are expected | MEDIUM | Markdown tables, summaries, recommended actions in chat bubbles |
| Teradata connection via user credentials | Users need to point the tool at their system | LOW | Host/port/user/password config; no service account, per PROJECT.md |
| Teradata brand identity (colors, typography) | Tool must feel native to the Teradata ecosystem — if it looks generic it loses trust | LOW | Orange #F37440, dark charcoal #1D1D1D, clean modern |

### Differentiators (Competitive Advantage)

Features that separate this tool from Viewpoint, Teradata Studio, and manual SQL scripts. These are where the AI-chat model creates unique value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural language to Teradata SQL | DBAs know what they want but don't want to write every query — especially complex DBC joins | HIGH | Claude translates intent to executable DBC queries; must validate before running |
| Skew analysis subagent | Skew is a silent performance killer; detecting and explaining it via AI is faster than manual DBC.TableSizeV analysis | HIGH | Uses DBC.TableSizeV + HASHAMP analysis; ranks tables by skew factor |
| Space usage & growth subagent | Perm space exhaustion causes job failures; proactive analysis of space trends is high-value and tedious | MEDIUM | Queries DBC.DiskSpaceV, database hierarchy, flags near-limit databases |
| Query performance analysis | DBAs spend significant time diagnosing slow queries — AI can explain EXPLAIN plans in natural language | HIGH | Parse EXPLAIN output, identify full table scans, inefficient joins, missing indexes |
| Workload analysis subagent | TASM/workload management is complex; AI surfacing which workloads are overloaded or misconfigured saves hours | HIGH | Queries DBQL (DBC.DBQLLogTbl), resource usage tables (DBC.ResUsageSpma) |
| DBQL log analysis | Query logging data is rich but rarely analysed systematically; AI can surface top resource consumers, bad SQL patterns | HIGH | DBC.DBQLogTbl / DBC.DBQLSummaryTbl — requires DBQL to be enabled |
| Subagent results with actionable recommendations | Existing tools surface data; this tool surfaces "here is what to fix and why" | MEDIUM | Claude synthesizes findings into prioritised action lists, not just raw data |
| Conversation memory within a session | DBAs iterate — "now filter that to just prod databases" requires context retention | MEDIUM | In-session message history passed to Claude; no persistent storage needed for v1 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Execute DDL/DML from chat | "Fix it for me" seems like the logical next step after analysis | Catastrophic if Claude misunderstands intent on a prod system; no undo on Teradata drops; legal/compliance risk | Surface the recommended SQL to copy-paste; user executes manually |
| Automated scheduling / cron jobs | "Run this analysis every Monday" is appealing for recurring tasks | Requires background service infrastructure; conflicts with local desktop model; opens questions about unattended execution | Export findings to clipboard or file; user schedules externally if needed |
| Downloadable reports / PDF export | Stakeholder reporting is a real need | Adds significant UI complexity (PDF rendering, layout) for v1 with unclear usage patterns | Chat output is already shareable as screenshots or copy-paste; defer to v2 |
| Multi-system / multi-connection management | DBAs often manage dev/test/prod — simultaneous connections seem useful | Multiplies context complexity, security risk of credential storage, and UI state management | Single active connection per session; user switches manually between sessions |
| Real-time streaming metrics (live dashboard) | Viewpoint does this and DBAs are used to it | Live polling requires persistent background processes incompatible with chat-first UX; competes with Viewpoint rather than complementing it | Viewpoint handles live monitoring; this tool handles analysis and diagnostics |
| LLM-generated automated fixes with apply button | Full automation | Risk of unintended changes to production; hallucinated fixes are dangerous at the DB layer | Always surface SQL as recommendation; user reviews and executes |

---

## Feature Dependencies

```
[Teradata Connection Config]
    └──requires──> [All Subagents]
    └──requires──> [Freeform Chat with DB Context]

[Security Auditing Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [DBC Access Rights (SELECT on DBC views)]

[MVC Analysis Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [DBC TableSizeV access]

[Statistics Analysis Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [HELP STATISTICS privilege or DBC.StatsTbl access]

[DBQL Log Analysis Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [DBQL enabled on the target system]
    └──requires──> [SELECT on DBC.DBQLogTbl or summary tables]

[Skew Analysis Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [DBC.TableSizeV access]

[Space Usage Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [DBC.DiskSpaceV access]

[Query Performance Analysis Subagent]
    └──requires──> [Teradata Connection Config]
    └──requires──> [EXPLAIN privilege or access to query history]
    └──enhances──> [DBQL Log Analysis Subagent]

[Rich Formatted Output]
    └──enhances──> [All Subagents]
    └──enhances──> [Freeform Chat]

[Conversation Memory (in-session)]
    └──enhances──> [Freeform Chat]
    └──enhances──> [Natural Language to SQL]
```

### Dependency Notes

- **All subagents require Teradata Connection Config:** Connection must be established and tested before any subagent can run. Connection setup is a Phase 1 gate.
- **DBQL Log Analysis requires DBQL to be enabled:** This is a DBA-controlled setting. Not all environments have it on. The subagent should detect and gracefully report if DBQL data is unavailable.
- **Security Auditing requires DBC view access:** The connecting user needs SELECT on DBC system views. This is typical for DBA accounts but should be documented as a prerequisite.
- **Query Performance Analysis enhances DBQL Log Analysis:** Both draw from query history but from different angles — DBQL gives broad patterns while EXPLAIN gives deep per-query analysis. They can share query retrieval infrastructure.
- **Conversation Memory enhances Natural Language to SQL:** Follow-up refinements ("filter that by database X") only work if the prior context is available in the prompt.

---

## MVP Definition

### Launch With (v1)

Minimum viable to validate the subagent pattern and deliver immediate DBA value.

- [ ] Teradata connection configuration (host, port, credentials) — without this, nothing works
- [ ] Chat interface with Teradata brand identity — the core UX frame
- [ ] Claude API integration — powers all AI capabilities
- [ ] Security Auditing subagent — high-value, commonly needed, well-defined DBC query set
- [ ] MVC Analysis subagent — concrete ROI for DBAs (space savings), well-understood pattern
- [ ] Statistics Analysis subagent — directly impacts query performance, highly repetitive task
- [ ] Subagent launcher UI (select and run prebuilt agents from the chat) — makes subagents discoverable
- [ ] Rich formatted output (findings as structured chat messages, not raw query dumps) — essential for usability
- [ ] Freeform chat about the connected Teradata environment — validates the conversational DBA use case

### Add After Validation (v1.x)

Add when v1 pattern is validated and DBA feedback collected.

- [ ] Skew Analysis subagent — high DBA value, depends on v1 subagent pattern being proven; add when first 3 subagents ship successfully
- [ ] Space Usage & Growth subagent — proactive capacity management; add when DBAs confirm they want operational analysis beyond performance
- [ ] Conversation memory within session — add when freeform chat feedback shows DBAs want iterative follow-ups
- [ ] Natural language to Teradata SQL (general) — high complexity, validate the simpler subagent pattern first

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] DBQL Log Analysis subagent — high value but requires DBQL to be enabled; environment dependency makes it risky as an early feature
- [ ] Query Performance Analysis subagent — powerful but complex (EXPLAIN parsing, plan interpretation); defer until v1 pattern is mature
- [ ] Workload Analysis subagent — TASM is a specialist topic; small subset of DBAs will need it; defer until broader adoption

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Teradata connection config | HIGH | LOW | P1 |
| Chat interface (branded) | HIGH | MEDIUM | P1 |
| Claude API integration | HIGH | MEDIUM | P1 |
| Security Auditing subagent | HIGH | HIGH | P1 |
| MVC Analysis subagent | HIGH | HIGH | P1 |
| Statistics Analysis subagent | HIGH | HIGH | P1 |
| Subagent launcher UI | HIGH | LOW | P1 |
| Rich formatted output | HIGH | MEDIUM | P1 |
| Freeform chat | HIGH | MEDIUM | P1 |
| Skew Analysis subagent | HIGH | HIGH | P2 |
| Space Usage subagent | HIGH | MEDIUM | P2 |
| Conversation memory (session) | MEDIUM | MEDIUM | P2 |
| Natural language to SQL | HIGH | HIGH | P2 |
| DBQL Log Analysis subagent | HIGH | HIGH | P3 |
| Query Performance Analysis subagent | HIGH | HIGH | P3 |
| Workload Analysis subagent | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Subagent Candidates Beyond Initial Three

The initial three (Security Auditing, MVC Analysis, Statistics Analysis) validate the pattern. Based on common Teradata DBA tasks, these are strong candidates for expansion:

| Subagent | Core DBA Pain | Data Sources | Complexity |
|----------|---------------|-------------|------------|
| **Skew Analysis** | Uneven AMP distribution causes bottlenecks; manual detection requires multi-step DBC queries | DBC.TableSizeV, HASHAMP analysis | HIGH |
| **Space Management** | Perm space near limits causes job aborts; growth trends not visible without scripting | DBC.DiskSpaceV, database hierarchy | MEDIUM |
| **DBQL Query Analysis** | Top resource-consuming queries and patterns buried in log tables DBAs rarely mine | DBC.DBQLogTbl, DBC.DBQLSummaryTbl | HIGH |
| **Query Performance / EXPLAIN Analysis** | Slow query diagnosis is the most time-consuming DBA task; natural language EXPLAIN interpretation is a clear AI win | EXPLAIN output, query plan parsing | HIGH |
| **Workload Management Review** | TASM rules accumulate over years and become opaque; auditing active rules and exceptions requires specialist knowledge | DBC workload management views, TASM config | HIGH |
| **Index Effectiveness Analysis** | Secondary indexes and join indexes consume space and maintenance overhead; unused or ineffective indexes need identification | DBC.Indices, DBC.TableSizeV, DBQL | HIGH |
| **User Management Audit** | Dormant accounts, over-privileged users, and orphaned roles are security risks; manual DBC.Users queries are time-consuming | DBC.Users, DBC.RoleMembers, DBC.LogOnOffV | MEDIUM |

---

## Competitor Feature Analysis

The primary comparators are existing Teradata tooling (Viewpoint, Studio) and adjacent AI DBA assistants (Oracle AWR.ai, IBM Database Assistant). There is no direct Teradata-specific AI chat DBA tool currently in market (as of March 2026).

| Feature | Teradata Viewpoint | Teradata Studio | Our Approach |
|---------|-------------------|-----------------|--------------|
| Query monitoring | Real-time portlets, live dashboard | SQL editor with explain | Chat-based analysis of DBQL history; not real-time |
| Space management | DiskSpaceV portlet, alerts | Manual SQL | Subagent synthesises findings + recommendations |
| Security/access review | Basic user portlet | Manual SQL | Dedicated subagent with AI-surfaced risks |
| Statistics analysis | None (must script manually) | None (must script manually) | Dedicated subagent — genuine gap in existing tools |
| MVC analysis | None (must script manually) | None (must script manually) | Dedicated subagent — genuine gap in existing tools |
| Natural language interface | None | None | Core differentiator |
| Actionable recommendations | Raw data only | Raw data only | Claude synthesises findings into recommended actions |
| Workload management | Full TASM portlet | None | Future subagent (v2+); Viewpoint does this better at v1 |
| Live monitoring | Full (this is its strength) | None | Out of scope — complement Viewpoint, don't replace it |

**Key insight:** Viewpoint excels at live monitoring; Teradata Studio excels at SQL editing. Neither tool provides AI-assisted analysis with natural language recommendations. The biggest gaps — Statistics analysis, MVC analysis, and AI-synthesised findings — are exactly where this tool targets.

---

## Sources

- [Teradata DBA Responsibilities — Teradata Docs](https://docs.teradata.com/r/Enterprise_IntelliFlex_VMware/Security-Administration/Setting-Up-the-Administrative-Infrastructure/Working-with-Administrative-Users/Database-Administrator-Responsibilities)
- [ZipRecruiter — Teradata DBA Daily Responsibilities](https://www.ziprecruiter.com/e/What-are-the-typical-day-to-day-responsibilities-of-a-Teradata-DBA)
- [Teradata Viewpoint Portal and Portlets — Teradata Docs](https://docs.teradata.com/r/Enterprise_IntelliFlex_VMware/Teradata-Viewpoint-User-Guide-24.08/Teradata-Viewpoint-Basics/Teradata-Viewpoint-Portal-and-Portlets)
- [Performance Tuning in Teradata — Medium](https://medium.com/@guruprasadnookala65/performance-tuning-in-teradata-best-practices-for-optimizing-sql-queries-9c8ced436c0d)
- [Teradata Table Skew — dwhpro.com](https://www.dwhpro.com/teradata-table-skew-misleading-natural-artificial/)
- [Teradata Space Management — dwhpro.com](https://www.dwhpro.com/teradata-space/)
- [Teradata DBQL Tables and Query Logging — dwhpro.com](https://www.dwhpro.com/teradata-query-logging-dbql/)
- [Teradata Workload Management TASM — dwhpro.com](https://www.dwhpro.com/teradata-workload-management-tasm/)
- [From DBA to Database Agent — Xata](https://xata.io/blog/dba-to-db-agent)
- [IBM Database Assistant announcement — IBM](https://www.ibm.com/new/announcements/introducing-ibm-database-assistant-an-ai-powered-assistant-for-database-administrators)
- [AI for DBAs — DBA University Blog](https://blog.dbauniversity.com/2025/09/ai-for-dbas-database-administrators.html)
- [Teradata Viewpoint Introduction — dwhpro.com](https://www.dwhpro.com/teradata-viewpoint-introduction/)
- [Finding and Fixing Skewed Tables — Teradata Docs](https://docs.teradata.com/r/B7Lgdw6r3719WUyiCSJcgw/FbHsNrvLOjLsatR7ILjFkw)
- [User Access Query in Teradata — TeraData Tech](https://www.teradatatech.com/?p=1567)

---

*Feature research for: Teradata DBA Agent (AI-powered local desktop chat tool)*
*Researched: 2026-03-24*
