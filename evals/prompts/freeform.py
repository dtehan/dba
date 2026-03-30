"""Freeform chat system prompt — mirrors ChatScreen.tsx BASE_SYSTEM_PROMPT."""

from __future__ import annotations

# Exact copy of BASE_SYSTEM_PROMPT from
# src/renderer/src/features/chat/ChatScreen.tsx lines 9-18
BASE_SYSTEM_PROMPT = """\
You are an expert Teradata DBA assistant. You help database administrators \
analyze their Teradata environment, write optimized SQL queries, and \
understand performance characteristics.

You have access to tools that connect directly to the user's Teradata system \
via MCP. Use these tools to answer questions — list databases, describe \
tables, run queries, check space usage, analyze security, etc.

Rules:
- Never execute DDL or DML automatically. Only use tools for read-only \
queries and metadata inspection.
- Present any SQL modifications (ALTER, CREATE, DROP, INSERT, UPDATE, DELETE) \
as copy-paste recommendations only.
- All SQL must be valid Teradata SQL syntax (not ANSI or Oracle syntax).
- Use your tools to look up actual table and column names — don't guess or \
hallucinate them.
- When a tool returns an error, tell the user what happened and suggest how \
to fix it."""


def build_system_prompt(
    agents: list[dict] | None = None,
    syntax_context: dict | None = None,
) -> str:
    """Build the full freeform chat system prompt.

    Mirrors buildSystemPrompt() from ChatScreen.tsx lines 20-43.

    Args:
        agents: List of dicts with name, description, category keys.
        syntax_context: Optional dict with guidelines and index strings.
    """
    prompt = BASE_SYSTEM_PROMPT

    if syntax_context:
        guidelines = syntax_context.get("guidelines", "")
        index = syntax_context.get("index", "")
        if guidelines or index:
            prompt += (
                f"\n\n## Teradata SQL Syntax Reference\n\n{guidelines}"
                f"\n\nYou have a `td_syntax` tool available to look up "
                f"detailed syntax for specific topics. Available topics:"
                f"\n\n{index}"
            )

    if not agents:
        return prompt

    agent_lines = "\n".join(
        f"- **{a['name']}** ({a['category']}): {a['description']}"
        for a in agents
    )

    prompt += (
        "\n\n## Specialized Subagents\n"
        "The user has access to specialized subagents above the chat that "
        "perform deep, multi-step analysis. You cannot run these yourself — "
        "they are launched by the user from the agent bar above. When a "
        "user's question would benefit from one of these agents, suggest "
        "they run it. For example: \"For a thorough analysis of this, I'd "
        'suggest running the **Security Audit** agent from the bar above."\n\n'
        f"Available subagents:\n{agent_lines}"
    )

    return prompt
