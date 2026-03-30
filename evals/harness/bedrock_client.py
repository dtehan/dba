"""Bedrock client wrapper for eval harness.

Mirrors the auth flow in src/main/services/bedrock-client.ts.
Reads credentials from environment variables.
"""

from __future__ import annotations

import os

import anthropic


def get_bedrock_client() -> tuple[anthropic.AnthropicBedrock, str]:
    """Create an AnthropicBedrock client using environment credentials.

    Returns:
        Tuple of (client, model_id).

    Environment variables:
        AWS_ACCESS_KEY_ID: Required.
        AWS_SECRET_ACCESS_KEY: Required.
        AWS_SESSION_TOKEN: Optional (for assumed roles).
        AWS_REGION: Default us-west-2.
        AWS_ROLE_ARN: Optional — if set, assumes role via STS first.
        EVAL_MODEL: Model ID override. Default matches app's DEFAULT_MODEL.
    """
    region = os.environ.get("AWS_REGION", "us-west-2")
    model_id = os.environ.get(
        "EVAL_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0"
    )
    role_arn = os.environ.get("AWS_ROLE_ARN", "")

    access_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    session_token = os.environ.get("AWS_SESSION_TOKEN")

    if role_arn:
        import boto3

        sts = boto3.client(
            "sts",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        assumed = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="teradata-dba-eval",
            DurationSeconds=3600,
        )
        creds = assumed["Credentials"]
        access_key = creds["AccessKeyId"]
        secret_key = creds["SecretAccessKey"]
        session_token = creds["SessionToken"]

    kwargs: dict = {
        "aws_region": region,
        "aws_access_key": access_key,
        "aws_secret_key": secret_key,
    }
    if session_token:
        kwargs["aws_session_token"] = session_token

    client = anthropic.AnthropicBedrock(**kwargs)
    return client, model_id
