# Phase 1: Foundation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can launch the app, configure their Teradata and Claude credentials securely, and see live connection status before any AI interaction begins. This phase delivers the Electron shell, credential management, MCP server connectivity, and Teradata-branded UI foundation.

</domain>

<decisions>
## Implementation Decisions

### MCP Server Strategy
- Use **teradata-mcp-server** (Python, official Teradata community) for database connectivity — requires Python runtime on user's machine
- **Bundle syntax markdown files** from tdsql-mcp into app resources — 21 Teradata SQL syntax reference files available for progressive disclosure to agents in later phases
- Pass credentials as **environment variables** when spawning the MCP server process
- **On-demand lifecycle** — spawn MCP server when credentials are saved/tested, kill on app close or credentials cleared

### Connection Health & Testing
- Teradata connection test: **execute `SELECT 1`** via MCP server — confirms end-to-end connectivity
- Claude API test: **send minimal messages request** (single "ping" message, max_tokens=1) — proves auth and generation capability
- Connection test timeout: **10 seconds** — accommodates slow Teradata instances without frustrating users
- Health poll: **pause on blur, resume on focus** — saves resources and avoids unnecessary Teradata load; polls every 30 seconds when focused

### Electron Architecture
- **Typed IPC channels with Zod validation** — renderer sends validated payloads via contextBridge, main process handles crypto + MCP
- **electron-vite default directory structure** — `src/main/`, `src/renderer/`, `src/preload/` with feature folders inside renderer
- **electron-store** for non-secret settings (host, port, UI preferences) — JSON persistence, not for credentials
- **Single window, native OS chrome** — Electron default title bar, enforce min size 1024×640 per UI-SPEC

### Claude's Discretion
- Python MCP server transport mechanism (stdio vs HTTP) — choose based on teradata-mcp-server's documented capabilities
- Exact IPC channel naming conventions
- electron-store schema structure
- Error handling patterns for MCP server process crashes

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — greenfield project. Only CLAUDE.md exists in the repo.

### Established Patterns
- Tech stack defined in CLAUDE.md: Electron 41, React 19, TypeScript, electron-vite 5.0, TailwindCSS v4, shadcn/ui, Zustand
- UI-SPEC.md already created with full design contract (colors, typography, spacing, components, layouts)

### Integration Points
- UI-SPEC.md defines the visual contract — implementation must match
- CLAUDE.md defines the tech stack — scaffolding must use specified versions
- teradata-mcp-server requires Python runtime — installer/docs must note this dependency

</code_context>

<specifics>
## Specific Ideas

- tdsql-mcp syntax markdown files should be bundled as static resources for progressive disclosure to agents — not used in Phase 1 but assets should be in place
- User explicitly chose teradata-mcp-server (Python) over tdsql-mcp (Node.js) for connectivity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
