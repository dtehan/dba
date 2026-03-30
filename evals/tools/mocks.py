"""Tool mock dispatcher for deterministic eval responses.

Pattern-matches tool calls to fixture files. For base_readQuery, matches on
DBC view names in the SQL since the LLM varies exact query formatting.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

# Map DBC view name patterns to fixture filenames for base_readQuery.
# Order matters — first match wins.
_SQL_PATTERNS: list[tuple[str, str]] = [
    (r"DBC\.ResUsageSvpr", "dbc_resusage_svpr.json"),
    (r"DBC\.ResUsageSpma", "dbc_resusage_spma.json"),
    (r"DBC\.AllSpaceV.*CurrentSpool", "dbc_allspacev_spool.json"),
    (r"DBC\.AllSpaceV.*CurrentPerm", "dbc_allspacev_perm.json"),
    (r"DBC\.AllSpaceV", "dbc_allspacev.json"),
    (r"DBC\.SessionInfoV", "dbc_sessioninfov.json"),
    (r"DBC\.LockInfoV", "dbc_lockinfov.json"),
    (r"DBC\.SoftwareEventLog", "dbc_software_event_log.json"),
    (r"DBC\.QryLogStepsV", "dbc_qrylog_steps.json"),
    (r"DBC\.QryLogV", "dbc_qrylogv.json"),
    (r"DBC\.AllRightsV", "dbc_allrightsv.json"),
    (r"DBC\.LogOnOffV", "dbc_logonoffv.json"),
    (r"DBC\.StatsV", "dbc_statsv.json"),
    (r"DBC\.IndicesV", "dbc_indicesv.json"),
    (r"DBC\.ColumnsV", "dbc_columnsv.json"),
    (r"DBC\.TablesV", "dbc_tablesv.json"),
    (r"DBC\.TableSizeV", "dbc_tablesizev.json"),
    (r"DBC\.QryLogObjectsV", "dbc_qrylog_objects.json"),
    (r"DBC\.TDWMSummaryLog", "dbc_tdwm_summary.json"),
    (r"DBC\.TDWMExceptionLog", "dbc_tdwm_exception.json"),
    (r"EXPLAIN\s", "explain_output.json"),
    (r"SELECT\s.*COUNT\(\*\)", "count_result.json"),
]


class ToolMockDispatcher:
    """Routes tool calls to fixture files based on tool name and input patterns."""

    def __init__(self, fixtures_dir: Path | None = None):
        self.fixtures_dir = fixtures_dir or FIXTURES_DIR
        self._cache: dict[str, str] = {}

    def execute(self, tool_name: str, tool_input: dict) -> str:
        """Dispatch a tool call and return a mock response string."""
        if tool_name == "base_readQuery":
            return self._match_sql(tool_input.get("query", ""))
        if tool_name == "td_syntax":
            return self._syntax_lookup(tool_input.get("topics", []))
        return self._load_keyed_fixture(tool_name, tool_input)

    def _match_sql(self, sql: str) -> str:
        """Match SQL against DBC view patterns and return fixture data."""
        for pattern, filename in _SQL_PATTERNS:
            if re.search(pattern, sql, re.IGNORECASE):
                return self._load_fixture("base_readQuery", filename)

        # Fallback: return empty result set
        return json.dumps({"results": [], "message": "No rows returned"})

    def _load_keyed_fixture(self, tool_name: str, tool_input: dict) -> str:
        """Load fixture by tool name, falling back to a default fixture."""
        tool_dir = self.fixtures_dir / tool_name
        if not tool_dir.exists():
            return json.dumps({"results": [], "message": f"No mock for {tool_name}"})

        # Try to find a fixture matching the primary input key
        for key, value in tool_input.items():
            candidate = tool_dir / f"{str(value).lower()}.json"
            if candidate.exists():
                return candidate.read_text(encoding="utf-8")

        # Fall back to default.json
        default = tool_dir / "default.json"
        if default.exists():
            return default.read_text(encoding="utf-8")

        return json.dumps({"results": [], "message": f"No fixture for {tool_name}"})

    def _syntax_lookup(self, topics: list[str]) -> str:
        """Return a static syntax reference for td_syntax tool calls."""
        lines = []
        for topic in topics:
            lines.append(
                f"## {topic}\n"
                f"Teradata SQL syntax for {topic}. "
                f"Use standard Teradata SQL conventions.\n"
            )
        return "\n".join(lines) if lines else "No topics specified."

    def _load_fixture(self, tool_name: str, filename: str) -> str:
        """Load a fixture file from the tool's fixture directory."""
        cache_key = f"{tool_name}/{filename}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        path = self.fixtures_dir / tool_name / filename
        if not path.exists():
            result = json.dumps(
                {"results": [], "message": f"Fixture not found: {path.name}"}
            )
        else:
            result = path.read_text(encoding="utf-8")

        self._cache[cache_key] = result
        return result
