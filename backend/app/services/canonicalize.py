import json
import re

import cohere

from app.config import config, get_api_key

PROMPT_V5 = """
You are a system that processes structured user input describing a project idea.

Your job is NOT to be creative. Your job is to:

* Extract, validate, and normalize the user's intent
* Refuse to assume or invent missing details
* Ask for clarification if the input is incomplete or vague

---

RULES:

1. Do NOT add any new information that is not explicitly present in the input.

2. TRACEABILITY CONSTRAINT:
   Every statement in the output must be directly supported by the input.
   If a statement cannot be traced back to the input, it MUST NOT be included.

3. SEMANTIC NORMALIZATION RULE:
   You may replace words or phrases with close semantic equivalents ONLY if:
   * The meaning remains identical
   * No additional information is introduced

   Examples:
   * "match students" <-> "connect students"
   * "find teammates" <-> "form teams"

   Not allowed:
   * Adding new concepts
   * Changing scope or meaning

4. NO BENEFIT GENERATION:
   Do NOT describe advantages, improvements, or outcomes
   (e.g., efficient, better, enhanced, seamless, improved)
   unless explicitly stated in the input.

5. Do NOT expand or enrich concepts beyond what is explicitly stated.
   Only minimal rephrasing for clarity and grammatical correctness is allowed.

6. Abbreviation normalization is allowed ONLY as direct equivalence:
   (e.g., AI -> Artificial Intelligence, ML -> Machine Learning).

7. If any part of the input is vague, underspecified, or ambiguous, you MUST flag it.

8. Prefer asking for clarification over making assumptions.

9. Keep outputs deterministic, structured, and consistent across similar inputs.

10. Specificity Criterion:
    A description is sufficiently specific if it includes:
    * a concrete mechanism (e.g., embeddings, similarity computation), AND/OR
    * a clearly defined functional process

    If BOTH are missing, request clarification.
    Do NOT require implementation-level detail.

---

RETURN FORMAT RULES:

* Output MUST be valid JSON only
* No markdown
* No explanations
* No multiple JSON objects
* No separators
* Return exactly ONE JSON object

---

EDGE CASE DEFINITIONS:

Treat input as "insufficient" if:
* Approach is generic (e.g., "use AI", "build a platform")
* Solution lacks a mechanism (no explanation of how it works)
* Total meaningful content is too short (< 20 words)

---

INPUT:
{user_input_json}

---

TASK:

Follow this control flow strictly:

1. Evaluate whether the input is sufficiently specific and complete.

2. IF the input is insufficient:
   Return ONLY:
   {{
   "status": "needs_revision",
   "feedback": [
   "Each feedback item must reference a specific field (e.g., Problem, Approach) and clearly state what is missing or vague, and what kind of detail is required."
   ]
   }}

3. ELSE:
   Generate a canonical description using STRICT TEMPLATE:

   TEMPLATE (strict sentence structure):
   Sentence 1: The project addresses [problem].
   Sentence 2: It proposes [solution idea].
   Sentence 3: The approach involves [approach].
   Sentence 4: [Include only if constraints are explicitly provided.]

   REQUIREMENTS:
   * 80-120 words
   * Single paragraph
   * Use ONLY information from input
   * Do NOT introduce new concepts, domains, or technologies
   * Do NOT add benefits, interpretations, or descriptive modifiers
   * Maintain consistent structure across similar inputs

   Return ONLY:
   {{
   "status": "approved",
   "canonical_text": "..."
   }}

DO NOT return intermediate analysis.
DO NOT return multiple outputs.
"""

ACTIVE_PROMPT = PROMPT_V5


def build_prompt(user_input: dict, prompt_template: str | None = None) -> str:
    template = prompt_template or ACTIVE_PROMPT
    user_input_json = json.dumps(user_input, indent=2)
    return template.replace("{user_input_json}", user_input_json)


def get_client() -> cohere.ClientV2:
    return cohere.ClientV2(api_key=get_api_key())


def call_cohere_llm(prompt: str, client: cohere.ClientV2) -> str:
    messages = [{"role": "user", "content": prompt}]

    try:
        response = client.chat(
            model=config["llm_model"],
            messages=messages,
            temperature=config["temperature"],
            max_tokens=config["max_tokens"],
        )
        return response.message.content[0].text
    except Exception:
        try:
            response = client.chat(
                model=config["llm_model"],
                messages=messages,
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
            )
            return response.message.content[0].text
        except Exception as retry_error:
            raise RuntimeError(f"LLM API failed after retry: {retry_error}") from retry_error


def clean_json_output(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("Empty LLM response")

    cleaned = text.strip()
    cleaned = re.sub(r"```json\s*", "", cleaned)
    cleaned = re.sub(r"```\s*", "", cleaned)

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM output: {text[:200]}")

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed JSON: {exc}") from exc


def validate_llm_output(output: dict) -> dict:
    if not isinstance(output, dict):
        return {"status": "error", "error": "Output is not a dict", "raw": str(output)}

    status = output.get("status")

    if status == "approved":
        if not output.get("canonical_text", "").strip():
            return {"status": "error", "error": "Missing canonical_text", "raw": str(output)}
    elif status == "needs_revision":
        feedback = output.get("feedback")
        if not feedback or not isinstance(feedback, list):
            return {"status": "error", "error": "Missing feedback list", "raw": str(output)}
    else:
        return {"status": "error", "error": f"Invalid status: {status}", "raw": str(output)}

    return output


def canonicalize(user_input: dict, client: cohere.ClientV2) -> dict:
    prompt = build_prompt(user_input)
    raw_response = call_cohere_llm(prompt, client)
    parsed = clean_json_output(raw_response)
    return validate_llm_output(parsed)
