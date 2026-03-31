"""Write optimized prompts back to subagent .md files with versioning.

Before overwriting a prompt, the previous version is archived to
``subagents/versions/{agent_id}/v{N}.md`` so optimization history is
preserved.  A ``manifest.json`` in each version directory tracks
metadata (score, timestamp, trial count).
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from prompts.loader import _parse_frontmatter, SUBAGENTS_DIR

VERSIONS_DIR = SUBAGENTS_DIR / "versions"
FREEFORM_VERSIONS_DIR = Path(__file__).resolve().parent / "output" / "freeform_versions"


def _extract_template_vars(template: str) -> set[str]:
    """Extract all ``{{variable}}`` names (including block markers) from a template."""
    return set(re.findall(r"\{\{[#^/]?(\w+)\}\}", template))


def _reconstruct_md(frontmatter_raw: str, body: str) -> str:
    """Reassemble a markdown file from raw frontmatter YAML and body."""
    return f"---\n{frontmatter_raw}\n---\n\n{body}\n"


def _next_version(version_dir: Path) -> int:
    """Determine the next version number from existing files."""
    if not version_dir.exists():
        return 1
    existing = [
        int(p.stem[1:])
        for p in version_dir.glob("v*.md")
        if p.stem[1:].isdigit()
    ]
    return max(existing, default=0) + 1


def _read_manifest(version_dir: Path) -> list[dict]:
    """Read the version manifest, or return empty list."""
    manifest_path = version_dir / "manifest.json"
    if manifest_path.exists():
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    return []


def _write_manifest(version_dir: Path, entries: list[dict]) -> None:
    """Write the version manifest."""
    manifest_path = version_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(entries, indent=2) + "\n", encoding="utf-8"
    )


def _archive_current(
    agent_id: str,
    current_content: str,
    version_dir: Path,
    score: float,
    trials: int,
    is_original: bool = False,
) -> int:
    """Archive the current prompt as a numbered version.

    Returns the version number assigned.
    """
    version_dir.mkdir(parents=True, exist_ok=True)
    version_num = _next_version(version_dir)
    dest = version_dir / f"v{version_num}.md"
    dest.write_text(current_content, encoding="utf-8")

    # Update manifest
    entries = _read_manifest(version_dir)
    entries.append({
        "version": version_num,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "score": score,
        "trials": trials,
        "source": "original" if is_original else "dspy-miprov2",
        "file": dest.name,
    })
    _write_manifest(version_dir, entries)

    return version_num


def write_optimized_subagent(
    agent_id: str,
    optimized_body: str,
    score: float = 0.0,
    trials: int = 0,
    original_score: float = 0.0,
) -> Path:
    """Version the current prompt and write the optimized one in-place.

    1. Archives the current ``subagents/{agent_id}.md`` to
       ``subagents/versions/{agent_id}/v{N}.md``
    2. Overwrites the original file with the optimized body
    3. Updates ``manifest.json`` with metadata

    Args:
        agent_id: Subagent identifier.
        optimized_body: The optimized system prompt markdown body.
        score: Best score achieved by the optimized prompt.
        trials: Number of optimization trials run.
        original_score: Score of the original prompt (for manifest).

    Returns:
        Path to the written file (the original, now updated).

    Raises:
        ValueError: If the optimized body is missing template variables.
    """
    original_path = SUBAGENTS_DIR / f"{agent_id}.md"
    if not original_path.exists():
        raise FileNotFoundError(f"Subagent not found: {original_path}")

    content = original_path.read_text(encoding="utf-8")

    # Extract raw frontmatter text
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        raise ValueError(f"No frontmatter found in {original_path}")
    fm_raw = match.group(1)

    # Validate template variables are preserved
    _, original_body = _parse_frontmatter(content)
    original_vars = _extract_template_vars(original_body)
    optimized_vars = _extract_template_vars(optimized_body)
    missing = original_vars - optimized_vars
    if missing:
        raise ValueError(
            f"Optimized prompt for {agent_id} is missing template variables: "
            f"{missing}. Optimization may have corrupted the prompt."
        )

    version_dir = VERSIONS_DIR / agent_id

    # Archive current version first (before overwriting)
    # Check if v1 exists — if not, this is the first optimization run,
    # so archive the original as v1 before writing the optimized as current.
    if not (version_dir / "v1.md").exists():
        _archive_current(
            agent_id, content, version_dir,
            score=original_score, trials=0, is_original=True,
        )

    # Write optimized prompt as new version in archive
    optimized_content = _reconstruct_md(fm_raw, optimized_body)
    version_num = _archive_current(
        agent_id, optimized_content, version_dir,
        score=score, trials=trials,
    )

    # Overwrite the active prompt
    original_path.write_text(optimized_content, encoding="utf-8")

    return original_path


def write_optimized_freeform(
    optimized_base_prompt: str,
    score: float = 0.0,
    trials: int = 0,
    original_score: float = 0.0,
) -> Path:
    """Version and write the optimized freeform chat prompt.

    Archives to ``optimization/output/freeform_versions/v{N}.txt``,
    and updates both ``evals/prompts/freeform.py`` and the renderer
    source ``ChatScreen.tsx``.

    Returns:
        Path to the updated freeform.py file.
    """
    freeform_py = Path(__file__).resolve().parent.parent / "prompts" / "freeform.py"
    content = freeform_py.read_text(encoding="utf-8")

    # Archive current version
    FREEFORM_VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    version_num = _next_version(FREEFORM_VERSIONS_DIR)

    # For first run, archive the original
    if not (FREEFORM_VERSIONS_DIR / "v1.txt").exists():
        # Extract current BASE_SYSTEM_PROMPT value
        match = re.search(
            r'BASE_SYSTEM_PROMPT\s*=\s*"""\\?\n?(.*?)"""',
            content,
            re.DOTALL,
        )
        if match:
            original_text = match.group(1)
            dest = FREEFORM_VERSIONS_DIR / "v1.txt"
            dest.write_text(original_text, encoding="utf-8")
            entries = _read_manifest(FREEFORM_VERSIONS_DIR)
            entries.append({
                "version": 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "score": original_score,
                "trials": 0,
                "source": "original",
                "file": "v1.txt",
            })
            _write_manifest(FREEFORM_VERSIONS_DIR, entries)
            version_num = 2  # next after original

    # Archive optimized version
    dest = FREEFORM_VERSIONS_DIR / f"v{version_num}.txt"
    dest.write_text(optimized_base_prompt, encoding="utf-8")
    entries = _read_manifest(FREEFORM_VERSIONS_DIR)
    entries.append({
        "version": version_num,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "score": score,
        "trials": trials,
        "source": "dspy-miprov2",
        "file": f"v{version_num}.txt",
    })
    _write_manifest(FREEFORM_VERSIONS_DIR, entries)

    # Update freeform.py in place
    pattern = r'(BASE_SYSTEM_PROMPT\s*=\s*""")\\?\n?.*?(""")'
    replacement = f'\\1\\\n{optimized_base_prompt}\\2'
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    freeform_py.write_text(new_content, encoding="utf-8")

    return freeform_py
