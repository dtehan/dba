# Milestones

## v1.0 MVP (Shipped: 2026-03-27)

**Phases completed:** 4 phases, 17 plans, 25 tasks

**Key accomplishments:**

- Electron 41 + React 19 desktop app scaffolded with TailwindCSS v4 Teradata design tokens, shadcn/ui 9-component library, typed IPC preload, and security-hardened BrowserWindow
- Typed IPC bridge with safeStorage credential encryption, Zod-validated handlers, and electron-store persistence — secrets never leave the main process
- MCP server spawning via uvx with percent-encoded DATABASE_URI, Claude API ping test with 10s timeout, and 30s health polling that pauses on blur and pushes ConnectionStatus to renderer
- Teradata-branded Electron app shell with 220px sidebar, 48px status bar, Zustand nav store, and IPC connection status subscription
- Full credential settings screen with Teradata and Claude API forms, show/hide password, save/test/clear IPC flows, inline alert feedback, and 5-second double-confirm destructive action
- Chat UI with streamdown markdown streaming, Enter-to-send textarea, Streamdown animated assistant bubbles, and Chat as the default home screen replacing WelcomeState
- MCP tool call service fetching Teradata databases/tables/columns via JSON-RPC, formatted as 4K-token-capped Markdown for Claude system prompt injection
- Subagent registry with echo test agent, orange-bordered SubagentResultCard, collapsible launcher panel, and database selector wiring schema context from MCP into Claude system prompt
- Security Audit subagent with 20-round non-streaming tool-use loop, DBC.AllRightsV/LogOnOffV analysis, and prioritized HIGH/MEDIUM/LOW findings report with Teradata remediation SQL
- MVC Analysis subagent with complete Package Bit-Cost Model algorithm (Jim Calvert, Teradata/NCR) encoded in system prompt, using 100-round tool-use loop and 16,384-token output budget
- Teradata skew analysis subagent with 5-step DBC view pipeline: per-AMP TableSizeV skew factor, IndicesV PI cause lookup, ColumnsV cardinality check, and ALTER TABLE PI alternative suggestions ranked CRITICAL/HIGH/MEDIUM/LOW
- Space Usage subagent with dual-mode DBC.AllSpaceV perm space analysis, 80%/95% capacity alerting, and categorized space recovery recommendations

---
