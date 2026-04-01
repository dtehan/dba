"""Load and render subagent system prompts from the markdown definition files.

Reads directly from ../subagents/*.md — no duplication of prompts.
Ports the frontmatter parsing and template rendering logic from
src/main/subagents/registry.ts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

SUBAGENTS_DIR = Path(__file__).resolve().parent.parent.parent / "subagents"


@dataclass
class SubagentParam:
    key: str
    label: str
    placeholder: str
    required: bool


@dataclass
class SubagentConfig:
    id: str
    name: str
    description: str
    icon: str
    category: str
    system_prompt: str
    tool_filter: list[str]
    max_tool_rounds: int
    max_tokens: int
    initial_message: str
    params: list[SubagentParam] = field(default_factory=list)


def render_template(template: str, params: dict[str, str]) -> str:
    """Render Mustache-like template variables in a prompt body.

    Supports:
      {{#key}}...{{/key}}  — shown when key has a non-empty value
      {{^key}}...{{/key}}  — shown when key is empty or missing
      {{key}}              — simple substitution
    """
    result = template

    # Conditional blocks: {{#key}}content{{/key}}
    def replace_positive(match: re.Match) -> str:
        key = match.group(1)
        content = match.group(2)
        if params.get(key, "").strip():
            # Replace nested {{var}} inside the block
            return re.sub(
                r"\{\{(\w+)\}\}",
                lambda m: params.get(m.group(1), ""),
                content,
            )
        return ""

    result = re.sub(
        r"\{\{#(\w+)\}\}([\s\S]*?)\{\{/\1\}\}", replace_positive, result
    )

    # Inverse blocks: {{^key}}content{{/key}}
    def replace_negative(match: re.Match) -> str:
        key = match.group(1)
        content = match.group(2)
        if not params.get(key, "").strip():
            return content
        return ""

    result = re.sub(
        r"\{\{\^(\w+)\}\}([\s\S]*?)\{\{/\1\}\}", replace_negative, result
    )

    # Simple substitution: {{key}}
    result = re.sub(
        r"\{\{(\w+)\}\}", lambda m: params.get(m.group(1), ""), result
    )

    return result


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split a markdown file into YAML frontmatter dict and body string."""
    match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if not match:
        return {}, content.strip()

    fm = yaml.safe_load(match.group(1)) or {}
    body = match.group(2).strip()
    return fm, body


def load_subagent_config(
    agent_id: str,
    params: dict[str, str] | None = None,
) -> SubagentConfig:
    """Load a single subagent by ID and render its system prompt with params."""
    params = params or {}
    md_path = SUBAGENTS_DIR / agent_id / "prompt.md"
    if not md_path.exists():
        raise FileNotFoundError(f"Subagent definition not found: {md_path}")

    content = md_path.read_text(encoding="utf-8")
    fm, body = _parse_frontmatter(content)

    name = fm.get("name", agent_id)
    description = fm.get("description", "")
    icon = fm.get("icon", "Terminal")
    category = fm.get("category", "General")

    tools_raw = fm.get("tools", "")
    tool_filter = [t.strip() for t in str(tools_raw).split(",") if t.strip()]

    max_tool_rounds = int(fm.get("max_tool_rounds", 20))
    max_tokens = int(fm.get("max_tokens", 8192))

    raw_params = fm.get("params", [])
    parsed_params = []
    if isinstance(raw_params, list):
        for p in raw_params:
            if isinstance(p, dict) and p.get("key"):
                parsed_params.append(
                    SubagentParam(
                        key=str(p["key"]),
                        label=str(p.get("label", p["key"])),
                        placeholder=str(p.get("placeholder", "")),
                        required=bool(p.get("required", False)),
                    )
                )

    system_prompt = render_template(body, params)

    # Build initial message (mirrors registry.ts:230-240)
    param_desc = ", ".join(
        f"{k}: {v}" for k, v in params.items() if v and v.strip()
    )
    initial_message = "Run the analysis as described in your instructions."
    if param_desc:
        initial_message += f" Parameters: {param_desc}"

    return SubagentConfig(
        id=agent_id,
        name=name,
        description=description,
        icon=icon,
        category=category,
        system_prompt=system_prompt,
        tool_filter=tool_filter,
        max_tool_rounds=max_tool_rounds,
        max_tokens=max_tokens,
        initial_message=initial_message,
        params=parsed_params,
    )


def list_subagent_ids() -> list[str]:
    """Return sorted list of all subagent IDs (filenames without .md)."""
    if not SUBAGENTS_DIR.exists():
        return []
    return sorted(
        p.parent.name for p in SUBAGENTS_DIR.glob("*/prompt.md")
        if not p.parent.name.startswith("_")
    )


def load_all_subagent_configs(
    default_params: dict[str, dict[str, str]] | None = None,
) -> list[SubagentConfig]:
    """Load all subagent configs with optional per-agent params."""
    default_params = default_params or {}
    configs = []
    for agent_id in list_subagent_ids():
        params = default_params.get(agent_id, {})
        configs.append(load_subagent_config(agent_id, params))
    return configs
