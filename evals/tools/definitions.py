"""MCP tool schemas in Anthropic API format.

These mirror the tools exposed by the Teradata MCP server, as consumed by
bedrock-client.ts getMcpToolsForClaude().
"""

from __future__ import annotations

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "base_readQuery",
        "description": "Execute a read-only SQL query against the Teradata database and return results as JSON.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The SQL query to execute. Must be a SELECT or EXPLAIN statement.",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "base_tableList",
        "description": "List all tables in a given database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "databaseName": {
                    "type": "string",
                    "description": "The database name to list tables for.",
                }
            },
            "required": ["databaseName"],
        },
    },
    {
        "name": "base_columnDescription",
        "description": "Get column names, types, and descriptions for a table.",
        "input_schema": {
            "type": "object",
            "properties": {
                "databaseName": {
                    "type": "string",
                    "description": "The database containing the table.",
                },
                "tableName": {
                    "type": "string",
                    "description": "The table name to describe.",
                },
            },
            "required": ["databaseName", "tableName"],
        },
    },
    {
        "name": "base_tableDDL",
        "description": "Get the CREATE TABLE DDL statement for a table.",
        "input_schema": {
            "type": "object",
            "properties": {
                "databaseName": {
                    "type": "string",
                    "description": "The database containing the table.",
                },
                "tableName": {
                    "type": "string",
                    "description": "The table name.",
                },
            },
            "required": ["databaseName", "tableName"],
        },
    },
    {
        "name": "dba_tableSpace",
        "description": "Get storage space usage details for a specific table.",
        "input_schema": {
            "type": "object",
            "properties": {
                "databaseName": {
                    "type": "string",
                    "description": "The database containing the table.",
                },
                "tableName": {
                    "type": "string",
                    "description": "The table name.",
                },
            },
            "required": ["databaseName", "tableName"],
        },
    },
    {
        "name": "sec_userRoles",
        "description": "List all roles assigned to a specific user.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "The username to look up roles for.",
                }
            },
            "required": ["username"],
        },
    },
    {
        "name": "sec_userDbPermissions",
        "description": "List access rights granted to a user on databases and objects.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "The username to look up permissions for.",
                }
            },
            "required": ["username"],
        },
    },
    {
        "name": "sec_rolePermissions",
        "description": "List permissions attached to a specific role.",
        "input_schema": {
            "type": "object",
            "properties": {
                "roleName": {
                    "type": "string",
                    "description": "The role name to look up permissions for.",
                }
            },
            "required": ["roleName"],
        },
    },
    {
        "name": "td_syntax",
        "description": "Look up Teradata SQL syntax reference for specific topics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of syntax topic names to look up.",
                }
            },
            "required": ["topics"],
        },
    },
]


def get_tool_definitions(tool_filter: list[str] | None = None) -> list[dict]:
    """Return tool definitions, optionally filtered by name.

    Always includes td_syntax (mirrors chat.ts behavior).
    """
    if tool_filter is None:
        return TOOL_DEFINITIONS

    names = set(tool_filter) | {"td_syntax"}
    return [t for t in TOOL_DEFINITIONS if t["name"] in names]
