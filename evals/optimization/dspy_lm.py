"""Configure DSPy to use AWS Bedrock Claude or Google Gemini as its language model.

Reads the same environment variables as harness/bedrock_client.py and
harness/gemini_client.py so the optimizer uses identical credentials
and model configuration.
"""

from __future__ import annotations

import os
from pathlib import Path

import dspy


def configure_dspy_lm(
    model_override: str | None = None,
) -> dspy.LM:
    """Configure and activate a DSPy LM backed by the configured provider.

    Reads EVAL_PROVIDER to choose between Bedrock and Gemini.
    Returns the configured ``dspy.LM`` instance (also sets it globally).
    """
    # Load .env
    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass

    provider = os.environ.get("EVAL_PROVIDER", "bedrock").lower()

    if provider == "gemini":
        return _configure_gemini_lm(model_override)
    return _configure_bedrock_lm(model_override)


def _configure_bedrock_lm(model_override: str | None = None) -> dspy.LM:
    """Configure DSPy with AWS Bedrock Claude."""
    region = os.environ.get("AWS_REGION", "us-west-2")
    model_id = model_override or os.environ.get(
        "EVAL_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0"
    )

    # If an STS role ARN is provided, assume it first so that the
    # temporary credentials are available as env vars for litellm.
    role_arn = os.environ.get("AWS_ROLE_ARN")
    if role_arn:
        _assume_role(role_arn, region)

    # litellm Bedrock provider expects the ``bedrock/`` prefix.
    litellm_model = f"bedrock/{model_id}"

    lm = dspy.LM(
        model=litellm_model,
        max_tokens=4096,
        temperature=0.0,
        aws_region_name=region,
    )

    dspy.configure(lm=lm)
    return lm


def _configure_gemini_lm(model_override: str | None = None) -> dspy.LM:
    """Configure DSPy with Google Gemini."""
    model_id = model_override or os.environ.get(
        "EVAL_GEMINI_MODEL", "gemini-2.5-flash"
    )
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set for DSPy Gemini configuration")

    # litellm Gemini provider expects the ``gemini/`` prefix.
    litellm_model = f"gemini/{model_id}"

    lm = dspy.LM(
        model=litellm_model,
        max_tokens=4096,
        temperature=0.0,
        api_key=api_key,
    )

    dspy.configure(lm=lm)
    return lm


def _assume_role(role_arn: str, region: str) -> None:
    """Assume an IAM role and inject temporary credentials into env vars."""
    import boto3

    sts = boto3.client("sts", region_name=region)
    resp = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="dspy-optimization",
    )
    creds = resp["Credentials"]
    os.environ["AWS_ACCESS_KEY_ID"] = creds["AccessKeyId"]
    os.environ["AWS_SECRET_ACCESS_KEY"] = creds["SecretAccessKey"]
    os.environ["AWS_SESSION_TOKEN"] = creds["SessionToken"]
