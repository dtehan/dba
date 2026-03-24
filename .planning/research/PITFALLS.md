# Pitfalls Research

**Domain:** AI-powered Teradata DBA desktop chat application with specialized subagents
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH (Teradata-specific items: MEDIUM; Claude API/LLM agent items: HIGH; desktop app security items: HIGH)

---

## Critical Pitfalls

### Pitfall 1: Credentials Stored in Plaintext or Config Files

**What goes wrong:**
The application stores Teradata hostname, username, and password — and the Anthropic API key — in a plain JSON/YAML config file on disk. Any process running as the same OS user, or any other user with filesystem access, can read them directly. This is especially dangerous for Teradata credentials because they give direct access to production data warehouses.

**Why it happens:**
It is the path of least resistance during development. `config.json` is easy to read, easy to write, and keeps setup simple. Developers defer "secure storage" as a polish task and then never revisit it.

**How to avoid:**
Use platform-native secure storage from day one:
- **macOS Keychain** via Electron's `safeStorage` API or the `keytar` package
- **Windows Credential Manager** via the same `keytar` abstraction
- **Linux libsecret / GNOME Keyring** via `keytar`

Store only a reference key in config; store credentials in the OS keychain. The Teradata password and the Anthropic API key must never appear in any file that could be accidentally committed to git or shared.

**Warning signs:**
- Config file contains `password`, `apiKey`, or `token` fields with real values
- `.gitignore` is the only protection against credential leakage
- App works without the OS prompting for any keychain access at first run

**Phase to address:** Foundation / project setup phase — credential storage architecture must be established before the first credential input screen is built.

---

### Pitfall 2: LLM Generating Unsafe or Destructive Teradata SQL

**What goes wrong:**
The freeform chat subagent, when asked general questions about a Teradata environment, may generate and execute DDL/DML statements (DROP, DELETE, UPDATE, TRUNCATE) rather than safe read-only SELECT queries. A single misunderstood request — "clean up that table" — could execute destructive SQL against production.

**Why it happens:**
LLMs are generative by nature. Without hard guardrails, the model will produce whatever SQL seems like the right answer to the question, including mutations. The developer assumes the DBA user "would never ask for that" but the model cannot distinguish safe intent from dangerous intent.

**How to avoid:**
- Implement a query execution layer that parses all generated SQL before execution and rejects anything containing DDL or DML keywords (DROP, DELETE, INSERT, UPDATE, TRUNCATE, CREATE, ALTER, REPLACE, MERGE)
- Only SELECTs and SHOW/HELP/EXPLAIN statements should be auto-executed
- Add an explicit confirmation step for any query the model generates before it runs
- Include a hard constraint in every system prompt: "You may only generate SELECT, SHOW, HELP, and EXPLAIN statements. Never generate DDL or DML."

**Warning signs:**
- System prompt does not explicitly enumerate permitted SQL statement types
- Query execution path accepts any string from the LLM without validation
- No confirmation dialog exists before query execution

**Phase to address:** Core chat and query execution phase — this constraint must be baked into the execution layer architecture, not added as an afterthought.

---

### Pitfall 3: Teradata Query Returning Millions of Rows into Chat

**What goes wrong:**
The subagents or freeform chat execute queries against large Teradata tables without row limits. A DBA asks about a large table and the agent issues `SELECT * FROM huge_table` — millions of rows flow into the application, exhausting memory, crashing the process, and overflowing the LLM context window (and token budget) when the result is passed back to Claude for analysis.

**Why it happens:**
The queries that subagents need to run for analysis (security audits, MVC candidates, statistics) are exploratory. Without explicit limits in the query template or execution layer, nothing stops a result set from being enormous.

**How to avoid:**
- All LLM-generated queries must pass through a result-set capping layer: auto-inject `TOP N` or `SAMPLE N` into any SELECT without an existing limit
- Subagent query templates must be designed with aggregation rather than row enumeration (e.g., summarize candidate tables rather than return all columns for analysis)
- Stream or paginate results from the Teradata driver; never buffer an entire result set into memory before processing
- The JDBC driver has a known bug with `setQueryTimeout` and result sets over 1 MB — use fetch-size controls and row caps instead of relying on timeouts

**Warning signs:**
- Subagent query templates contain `SELECT *` or return per-row data from large tables
- No `TOP`, `SAMPLE`, or `QUALIFY ROW_NUMBER()` clause in templates
- Memory usage spikes during query execution in testing

**Phase to address:** Subagent query template design phase — the first subagent built must establish the result-capping pattern for all subsequent subagents to inherit.

---

### Pitfall 4: LLM Hallucinating Teradata Schema (Wrong Table/Column Names)

**What goes wrong:**
When the freeform chat agent generates SQL or discusses the DBA's specific environment, it invents table names, column names, and database/schema names that do not exist. The DBA receives confident-sounding queries that fail on execution or, worse, coincidentally match a wrong table.

**Why it happens:**
LLMs have strong SQL generation ability but no knowledge of the specific Teradata instance the DBA is connected to. Without schema context in the prompt, the model draws on training data about generic database schemas and confidently produces plausible but wrong SQL.

**How to avoid:**
- Before any freeform chat query is executed, retrieve relevant schema metadata from Teradata's DBC system views (`DBC.Tables`, `DBC.Columns`, `DBC.Databases`) and inject it into the system prompt as schema context
- Subagents should always use parameterized template queries that reference schema objects by name only after validating those objects exist via a pre-flight DBC lookup
- Validate any LLM-generated SQL against the connected schema before execution: check that every referenced table and column exists in `DBC.Columns`

**Warning signs:**
- System prompt does not include current schema/table context from the connected instance
- Queries fail with "Table does not exist" or "Column not found" errors from the Teradata driver
- The application accepts LLM-generated SQL without a schema validation step

**Phase to address:** Freeform chat phase — schema grounding must be part of the initial chat architecture. Subagent phases are less affected because they use fixed query templates.

---

### Pitfall 5: Claude API Token Costs Exploding Due to Large Query Results in Context

**What goes wrong:**
Subagent results (rows from Teradata) are passed verbatim into the Claude API as user or tool messages. A single MVC analysis query returning 500 table candidates sends thousands of rows to Claude — each row costs input tokens. A session of 10 subagent invocations can consume hundreds of thousands of tokens and cost tens of dollars per session.

**Why it happens:**
It is natural to pass raw query results to the model for analysis. Developers do not calculate token cost of result sets during development because API cost is not visible until bills arrive.

**How to avoid:**
- Pre-process and aggregate query results in the application layer before sending to Claude: compute statistics, sort candidates, filter to top N, and pass a summary rather than raw rows
- Set explicit row caps on subagent result sets (e.g., top 50 compression candidates by estimated saving) before the data enters the LLM pipeline
- Use Claude's prompt caching for system prompts and static schema context — cached tokens are free to re-read
- Monitor token counts per subagent invocation during development; set a per-invocation budget threshold and alert when exceeded
- Use `claude-haiku` for data summarization passes and `claude-sonnet` only for final analysis/recommendations

**Warning signs:**
- Subagent results are passed as raw SQL result sets to Claude without preprocessing
- No per-call token counting in the application
- Monthly API costs exceed expected usage by 5x or more

**Phase to address:** First subagent phase — establish the data summarization pipeline pattern before building all three subagents. Changing this pattern after all three subagents are built is expensive.

---

### Pitfall 6: Connection Lifecycle Mismanagement (Teradata Session Leaks)

**What goes wrong:**
The application opens a Teradata connection per subagent invocation and fails to close it on error paths. Teradata sessions accumulate on the server, eventually hitting the system's session limit or the user's profile session limit, causing subsequent connections to be refused with authentication errors that look like credential problems.

**Why it happens:**
Python's `teradatasql` and JDBC connections require explicit close calls. Error handling paths that raise exceptions before the `close()` call silently leak the session. Teradata systems typically enforce per-user session limits (often 10-50 sessions for named users).

**How to avoid:**
- Use Python context managers (`with teradatasql.connect(...) as con`) exclusively — never open a connection outside a `with` block or equivalent try/finally
- Build a single shared connection object with reconnect logic rather than opening per-query connections
- Add a session health check on startup and display connected/disconnected status in the UI
- Log and surface Teradata error codes 3521 (session limit exceeded) as a user-facing diagnostic with instructions to check for leaked sessions via BTEQ or SQL Assistant

**Warning signs:**
- Connection is opened in a function that can raise exceptions before the close call
- The app creates a new connection for each subagent invocation
- Teradata error 3521 or "Maximum number of sessions" appears during testing

**Phase to address:** Connectivity foundation phase — connection management patterns must be established in the first working Teradata integration before subagents are built on top.

---

### Pitfall 7: Subagent Prompts Too Vague, Producing Inconsistent Analysis Quality

**What goes wrong:**
Security audit, MVC, and statistics subagents are built with high-level system prompts ("You are a Teradata DBA expert, analyze this data"). The quality and format of output varies wildly between runs. Sometimes recommendations are specific and actionable; sometimes they are generic DBA advice unrelated to the actual query results provided. DBAs lose trust in the tool.

**Why it happens:**
Subagent prompts are written quickly with the assumption that Claude "knows DBA work." The prompt does not specify the exact output format, the specific decision criteria, or which fields from the query result to focus on. Claude fills in the gaps with general knowledge.

**How to avoid:**
- Each subagent prompt must specify: the exact decision criteria (e.g., "flag a column for MVC if it has fewer than 50 distinct values and the table has more than 1 million rows"), the precise output format (structured sections, not free-form prose), and what to do when data is ambiguous
- Include 1-2 concrete examples in the system prompt (few-shot) showing input data and expected output format
- Define a schema for subagent output in the system prompt and validate the response against that schema before rendering — if it does not conform, re-prompt once with an explicit format correction request

**Warning signs:**
- Subagent output varies in structure between runs on the same data
- Recommendations do not reference specific table/column names from the query results
- DBAs describe output as "generic" or "not specific to my environment"

**Phase to address:** Each subagent's dedicated build phase — prompt engineering should be treated as a testable deliverable with example inputs and expected output schemas documented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding Teradata host in config | Faster first connection | Credentials in git, security incident risk | Never |
| Passing raw query rows to Claude | Simpler subagent code | Token costs 10-50x higher than necessary | Never |
| Opening new DB connection per query | No connection lifecycle to manage | Session leaks, hit session limit under load | Never |
| Single monolithic system prompt for all subagents | One file to maintain | Vague outputs, no format consistency | Never |
| No row limit on subagent queries | Query templates are simpler | OOM crash, context overflow, massive token spend | Never |
| Polling for query completion (sleep loop) | Simple implementation | Blocks UI thread, no cancellation possible | MVP only if async is deferred |
| Not streaming Claude responses | Simpler response handling | UI feels unresponsive; 10-30s blank wait for subagents | Never for subagents; acceptable only for very short responses |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| teradatasql Python driver | Using 32-bit Python — driver is 64-bit only, fails silently or with cryptic import errors | Verify 64-bit Python 3.7+ at startup; surface clear error if wrong Python arch detected |
| teradatasql Python driver | Assuming `QueryTimeout` applies to the full query lifecycle | `QueryTimeout` only applies to statement execution — fetch, spool release, and commit are not covered; use application-level watchdogs |
| teradatasql Python driver | Passing connection params in both JSON string and kwargs without understanding precedence | kwargs take precedence over JSON string params; document and use one approach consistently |
| Teradata Kerberos auth | Connecting via TPID (load-balanced entry point) with Kerberos | Kerberos can fail at load-balanced entry points; connect to a specific node when using Kerberos |
| Teradata SSL/TLS | Connecting without `sslmode=VERIFY_CA` in environments with `Require Confidentiality` enabled | The teradatasql driver will fail connection if the server requires SSL and the client does not present matching TLS config — test SSL config explicitly in each target environment |
| Claude API | Sending full conversation history with every request | Every message in history costs input tokens on every call; trim history aggressively beyond a rolling window |
| Claude API | Not handling 429 rate-limit responses with backoff | Production usage hits rate limits; implement exponential backoff with a user-facing "Claude is busy, retrying..." indicator |
| Electron safeStorage | Storing credentials before app is "ready" event | `safeStorage` is only available after Electron app ready; calling it early throws; always gate on `app.whenReady()` |
| Electron IPC | Exposing raw Node.js APIs to renderer process | Context isolation must be enabled; use `contextBridge` to expose only specific, named IPC functions — never `nodeIntegration: true` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded Teradata result sets | App memory exhaustion, process crash, or context overflow to Claude | Inject `TOP 500` (or equivalent) into all subagent queries; aggregate before returning | Any query against a production table with >100K rows |
| Full conversation history in every Claude API call | Slow responses, rising token costs, eventual 200K token context limit hit | Implement rolling window (last N messages) plus a one-time session summary; use prompt caching for system prompt | After ~20 messages in a session |
| Synchronous query execution on main thread | UI freezes during query execution; no way to cancel a long-running query | All Teradata queries must run in a worker thread/process; UI must remain responsive with progress indicator | First long-running subagent query (statistics analysis can take minutes on large systems) |
| Sequential subagent query execution | Subagents that need multiple queries run them one after another, making the total wait time additive | Where queries are independent, execute in parallel using Python `concurrent.futures` or async patterns | Any subagent with 3+ independent queries |
| Schema metadata fetched on every query | Repeated DBC queries add latency to every chat interaction | Cache schema metadata at session start; invalidate cache on reconnect | After the first 5-10 chat turns |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Anthropic API key stored in config file on disk | Key exfiltration via shared machine, accidental git commit, or malicious local process | Store in OS keychain via `safeStorage`/`keytar`; never write to any file |
| Teradata credentials stored in plaintext | Direct database access by any local process or user with filesystem access | Same as above — OS keychain is the only acceptable storage for production credentials |
| Electron `nodeIntegration: true` in renderer | Renderer process (which handles user input and LLM output) has full Node.js access — XSS in rendered content becomes RCE | Always use `contextBridge` with explicit IPC; set `nodeIntegration: false`, `contextIsolation: true` |
| Logging Teradata credentials or query results to console/file | Sensitive data in app logs persists to disk and may be included in bug reports | Strip credentials from all log output; consider a "sensitive mode" flag that redacts query results in logs |
| Executing LLM-generated SQL without validation | Model generates destructive DDL/DML that destroys production data | Allowlist-only SQL execution: only SELECT, SHOW, HELP, EXPLAIN pass through to execution |
| Unrestricted access rights for the connecting Teradata user | Subagent analysis queries run with DBA-level privileges, increasing blast radius of any SQL execution error | Document the minimum required permissions for the connecting user (read-only SELECT on DBC views, SELECT on analyzed databases) and enforce this in setup instructions |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No streaming for Claude responses | DBA waits 15-30 seconds staring at a blank chat bubble for subagent results | Implement SSE/streaming from Claude API; render tokens as they arrive |
| No progress indication during Teradata query execution | DBA cannot tell if the query is running, hung, or failed | Show a query execution indicator with elapsed time; provide a Cancel button that terminates the session |
| Subagent results rendered as raw JSON or unformatted text | Expert DBAs cannot scan results quickly; tool feels like a raw API wrapper | Render subagent results as structured chat messages: findings summary, then collapsible detail sections, with severity indicators for security audit findings |
| No "copy SQL" affordance on generated queries | DBA wants to take a generated query to SQL Assistant for verification but cannot extract it easily | Every SQL block in chat must have a one-click copy button |
| Error messages expose raw Teradata driver error codes | DBAs see cryptic "Error 3521: Maximum sessions" rather than actionable guidance | Map common Teradata error codes to human-readable explanations with remediation steps |
| Session state not preserved across app restarts | DBA closes the app and loses their conversation context | Persist conversation history to local storage; restore on next launch |
| No visual distinction between "chat" and "subagent is running" states | DBA does not know which subagent was triggered or how far along it is | Show a named subagent execution card ("Running: MVC Analysis...") separate from the chat stream |

---

## "Looks Done But Isn't" Checklist

- [ ] **Credential storage:** Credentials appear to save and reload correctly — verify they are in the OS keychain, not in a config file on disk
- [ ] **SQL safety:** Chat responds to database questions — verify it cannot generate or execute DDL/DML by explicitly asking it to "delete rows from" a table
- [ ] **Row limits:** Subagent queries return results — verify against a large table that the result set is capped and does not exhaust memory
- [ ] **Connection cleanup:** Subagents complete successfully — verify via BTEQ `SHOW WHERE SESSION` that sessions are cleaned up after subagent completion and on error paths
- [ ] **Token costs:** Subagents return analysis — verify the actual token count per invocation using the API response metadata; confirm it is under a reasonable threshold
- [ ] **Error recovery:** App starts and connects — verify behavior when Teradata is unreachable, when the Anthropic API key is invalid, and when a query times out
- [ ] **Electron IPC security:** App functions correctly — verify `nodeIntegration` is false and `contextIsolation` is true in `BrowserWindow` config
- [ ] **Streaming:** Claude responses appear in chat — verify they stream token-by-token rather than appearing all at once after a delay

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credentials stored in plaintext (discovered post-ship) | MEDIUM | Rotate all credentials immediately; add keychain migration on next launch that reads old config, moves to keychain, and deletes config fields |
| No row limits (OOM crash discovered) | LOW | Add `TOP N` injection in the query execution layer; no subagent logic changes required |
| Token costs exploding | MEDIUM | Instrument each subagent with token counting; identify the most expensive calls; add result pre-processing and summarization before LLM pass |
| Session leaks (session limit hit) | LOW | Wrap all connection calls in context managers; add session-count diagnostic query on connect |
| Subagent output quality poor | MEDIUM | Iterate on system prompt with few-shot examples; add output schema validation with re-prompt on failure |
| SQL safety gap (destructive query executed) | HIGH | Immediate hotfix to add SQL validation layer; incident review of any data modification; notify user |
| Context window overflow (conversation too long) | LOW | Implement rolling window and session summary; existing messages truncated gracefully |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Credentials in plaintext | Foundation / project setup | Inspect storage path at runtime; confirm keychain is used |
| Destructive SQL execution | Core chat + query execution | Attempt DDL via chat; verify rejection and no execution |
| Unbounded result sets | First subagent build | Run subagent against large table; verify row cap enforced |
| Schema hallucination | Freeform chat architecture | Query for a nonexistent table; verify model does not attempt execution |
| Token cost explosion | First subagent build | Instrument and measure tokens per invocation before second subagent |
| Session leaks | Connectivity foundation | Run 20 subagent cycles; verify session count stays constant via DBC.Sessions |
| Vague subagent output | Each subagent build phase | Run subagent against test data; verify output references specific objects |
| Electron IPC security | Foundation / app shell | Audit BrowserWindow config; attempt nodeIntegration access from renderer |
| No streaming | Chat UI phase | Measure time-to-first-token; verify incremental rendering |
| Long query blocking UI | Query execution layer | Issue a 30-second query; verify UI remains interactive and Cancel works |

---

## Sources

- [Teradata SQL Driver for Python — GitHub](https://github.com/Teradata/python-driver)
- [teradatasql on PyPI](https://pypi.org/project/teradatasql/)
- [Teradata JDBC Driver FAQ — session limits and timeout behavior](https://teradata-docs.s3.amazonaws.com/doc/connectivity/jdbc/reference/current/faq.html)
- [Teradata Multi-Value Compression — official docs](https://docs.teradata.com/r/Enterprise_IntelliFlex_VMware/SQL-Data-Types-and-Literals/SQL-Data-Definition/COMPRESS-and-DECOMPRESS-Phrases/Multi-value-Compression-MVC)
- [MVC Analysis: quick approach via SHOW STATISTICS VALUES](https://www.dwhpro.com/teradata-multivalue-compression-a-quick-approach/)
- [Teradata Statistics — stale statistics impact](https://www.dwhpro.com/teradata-stale-statistics/)
- [Comprehensive Guide to Teradata Statistics — common misconceptions](https://www.dwhpro.com/teradata-statistics-3/)
- [Teradata Security Features whitepaper](https://assets.teradata.com/resourceCenter/downloads/WhitePapers/EB1895_Security_%20Features_in_the_Teradata_Database.pdf)
- [Teradata Access Rights — dwhpro.com](https://www.dwhpro.com/teradata-access-rights/)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Securely storing credentials in Electron with keytar](https://cameronnokes.com/blog/how-to-securely-store-sensitive-information-in-electron-with-node-keytar/)
- [Hacking Electron Apps — security risks](https://redfoxsecurity.medium.com/hacking-electron-apps-security-risks-and-how-to-protect-your-application-9846518aa0c0)
- [Claude API rate limits — Anthropic docs](https://docs.anthropic.com/en/api/rate-limits)
- [Claude API context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [LLM context window management strategies — getmaxim.ai](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Reducing hallucinations in text-to-SQL — Wren AI](https://medium.com/wrenai/reducing-hallucinations-in-text-to-sql-building-trust-and-accuracy-in-data-access-176ac636e208)
- [Claude Code subagents — common mistakes](https://claudekit.cc/blog/vc-04-subagents-from-basic-to-deep-dive-i-misunderstood)
- [Claude prompting best practices — Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Streaming AI chat UX — building production streaming](https://medium.com/@theabhishek.040/building-production-ai-chat-streaming-react-nodejs-e5943f5ca507)

---
*Pitfalls research for: Teradata DBA Agent — AI-powered desktop chat application*
*Researched: 2026-03-24*
