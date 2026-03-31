"""Gemini client wrapper for eval harness.

Provides a Gemini client using the google-genai SDK.
Reads GEMINI_API_KEY from environment or .env file.
"""

from __future__ import annotations

import os
from pathlib import Path

from google import genai


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def _load_dotenv() -> None:
    """Load .env file from the evals directory if python-dotenv is available."""
    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass


def get_gemini_client() -> tuple[genai.Client, str]:
    """Create a Gemini client using environment credentials.

    Returns:
        Tuple of (client, model_id).

    Environment variables:
        GEMINI_API_KEY: Required.
        EVAL_GEMINI_MODEL: Model ID override. Default: gemini-2.5-flash.
    """
    _load_dotenv()

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY not set. Set it in environment or evals/.env file."
        )

    model_id = os.environ.get("EVAL_GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    client = genai.Client(api_key=api_key)

    return client, model_id
