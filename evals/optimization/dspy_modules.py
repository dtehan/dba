"""DSPy modules wrapping the Teradata DBA agent loop.

Each module exposes a ``task → report`` signature whose ``instructions``
field holds the system prompt.  DSPy's MIPROv2 optimizer rewrites the
instructions while the ``forward()`` method delegates to the real
``run_agent_loop()`` with mocked tools.
"""

from __future__ import annotations

from typing import Any

import dspy

from harness.agent_runner import ToolCall, run_agent_loop
from prompts.loader import render_template
from prompts.freeform import build_system_prompt
from tools.definitions import TOOL_DEFINITIONS


# ---------------------------------------------------------------------------
# Signatures — define the input/output contract DSPy optimizes
# ---------------------------------------------------------------------------


class SubagentSignature(dspy.Signature):
    """Run a Teradata DBA subagent analysis and produce a report."""

    task: str = dspy.InputField(desc="Initial message describing the analysis to run")
    report: str = dspy.OutputField(desc="Final analysis report produced by the subagent")


class FreeformSignature(dspy.Signature):
    """Answer a Teradata DBA question using available database tools."""

    task: str = dspy.InputField(desc="User question or request about their Teradata environment")
    report: str = dspy.OutputField(desc="Assistant response to the user's question")


# ---------------------------------------------------------------------------
# Modules — wrap run_agent_loop as a DSPy forward pass
# ---------------------------------------------------------------------------


class SubagentModule(dspy.Module):
    """Wraps a single subagent's multi-turn tool-using agent loop.

    The system prompt body is stored as the ``instructions`` of the
    inner ``Predict`` module's signature so MIPROv2 can rewrite it.
    Template variables (``{{key}}``) are rendered at forward-time using
    the example's ``params`` dict.
    """

    def __init__(
        self,
        agent_id: str,
        bedrock_client: Any,
        model_id: str,
        tool_executor: Any,
        original_template: str,
        tool_filter: list[str] | None = None,
        max_rounds: int = 10,
        max_tokens: int = 4096,
    ):
        super().__init__()
        self.agent_id = agent_id
        self.bedrock_client = bedrock_client
        self.model_id = model_id
        self.tool_executor = tool_executor
        self.original_template = original_template
        self.tool_filter = tool_filter
        self.max_rounds = max_rounds
        self.max_tokens = max_tokens

        # Filter tool definitions to those allowed by this subagent
        if tool_filter:
            self.tools = [t for t in TOOL_DEFINITIONS if t["name"] in tool_filter]
        else:
            self.tools = list(TOOL_DEFINITIONS)

        # The Predict module whose signature.instructions DSPy will optimize
        self.predict = dspy.Predict(SubagentSignature)
        # Inject the original prompt as the instruction text
        self.predict.signature = self.predict.signature.with_instructions(
            original_template
        )

    def forward(self, task: str, params: dict[str, str] | None = None) -> dspy.Prediction:
        """Execute the agent loop and return a Prediction with metadata.

        Instead of using DSPy's normal LM call, this overrides the
        behaviour to run the full agent loop with the current instruction
        (system prompt) text.
        """
        # Get the current instruction text (may have been rewritten by MIPROv2)
        instruction = str(self.predict.signature.instructions)

        # Render template variables for this scenario
        rendered_prompt = render_template(instruction, params or {})

        # Run the agent loop
        messages = [{"role": "user", "content": task}]
        result = run_agent_loop(
            client=self.bedrock_client,
            model=self.model_id,
            system_prompt=rendered_prompt,
            messages=messages,
            tools=self.tools,
            tool_executor=self.tool_executor,
            max_rounds=self.max_rounds,
            max_tokens=self.max_tokens,
        )

        return dspy.Prediction(
            report=result.final_text,
            # Metadata for metric scoring
            messages=result.messages,
            tool_calls=result.tool_calls,
            rounds_used=result.rounds_used,
            stop_reason=result.stop_reason,
            instruction_used=instruction,
        )


class FreeformChatModule(dspy.Module):
    """Wraps the freeform chat agent loop.

    The ``BASE_SYSTEM_PROMPT`` text is stored as the signature instruction.
    Dynamic sections (syntax reference, subagent list) are appended at
    forward-time via ``build_system_prompt()``.
    """

    def __init__(
        self,
        bedrock_client: Any,
        model_id: str,
        tool_executor: Any,
        base_prompt: str,
        agents: list[dict] | None = None,
        syntax_context: dict | None = None,
        max_rounds: int = 10,
        max_tokens: int = 4096,
    ):
        super().__init__()
        self.bedrock_client = bedrock_client
        self.model_id = model_id
        self.tool_executor = tool_executor
        self.agents = agents
        self.syntax_context = syntax_context
        self.max_rounds = max_rounds
        self.max_tokens = max_tokens
        self.tools = list(TOOL_DEFINITIONS)

        self.predict = dspy.Predict(FreeformSignature)
        self.predict.signature = self.predict.signature.with_instructions(
            base_prompt
        )

    def forward(self, task: str) -> dspy.Prediction:
        """Execute the freeform agent loop."""
        # Get the current (possibly optimized) base prompt
        optimized_base = str(self.predict.signature.instructions)

        # Build the full system prompt with dynamic sections appended
        # We temporarily monkey-patch the module-level constant so
        # build_system_prompt uses the optimized text.
        full_prompt = optimized_base
        if self.agents or self.syntax_context:
            # Manually replicate build_system_prompt logic using the
            # optimized base instead of the hardcoded constant.
            if self.syntax_context:
                guidelines = self.syntax_context.get("guidelines", "")
                index = self.syntax_context.get("index", "")
                if guidelines or index:
                    full_prompt += (
                        f"\n\n## Teradata SQL Syntax Reference\n\n{guidelines}"
                        f"\n\nYou have a `td_syntax` tool available to look up "
                        f"detailed syntax for specific topics. Available topics:"
                        f"\n\n{index}"
                    )
            if self.agents:
                agent_lines = "\n".join(
                    f"- **{a['name']}** ({a['category']}): {a['description']}"
                    for a in self.agents
                )
                full_prompt += (
                    "\n\n## Specialized Subagents\n"
                    "The user has access to specialized subagents above the chat that "
                    "perform deep, multi-step analysis. You cannot run these yourself — "
                    "they are launched by the user from the agent bar above. When a "
                    "user's question would benefit from one of these agents, suggest "
                    "they run it. For example: \"For a thorough analysis of this, I'd "
                    'suggest running the **Security Audit** agent from the bar above."\n\n'
                    f"Available subagents:\n{agent_lines}"
                )

        messages = [{"role": "user", "content": task}]
        result = run_agent_loop(
            client=self.bedrock_client,
            model=self.model_id,
            system_prompt=full_prompt,
            messages=messages,
            tools=self.tools,
            tool_executor=self.tool_executor,
            max_rounds=self.max_rounds,
            max_tokens=self.max_tokens,
        )

        return dspy.Prediction(
            report=result.final_text,
            messages=result.messages,
            tool_calls=result.tool_calls,
            rounds_used=result.rounds_used,
            stop_reason=result.stop_reason,
            instruction_used=optimized_base,
        )
