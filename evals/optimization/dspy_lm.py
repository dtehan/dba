"""Configure DSPy to use AWS Bedrock Claude as its language model.

Reads the same environment variables as harness/bedrock_client.py so the
optimizer uses identical credentials and model configuration.
"""

from __future__ import annotations

import os

import dspy


def configure_dspy_lm(
    model_override: str | None = None,
) -> dspy.LM:
    """Configure and activate a DSPy LM backed by AWS Bedrock.

    Uses litellm's ``bedrock/`` prefix under the hood.  Reads credentials
    from the standard AWS env vars and optionally assumes a role via STS
    when ``AWS_ROLE_ARN`` is set.

    Returns the configured ``dspy.LM`` instance (also sets it globally).
    """
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
