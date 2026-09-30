import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def analyze_test_failure(
    code: str,
    tests: str,
    error: dict
):

    prompt = f"""
You are an expert software testing and debugging engineer.

Analyze why the generated test failed.

SOURCE CODE:
{code}

GENERATED TESTS:
{tests}

TEST FAILURE:
{json.dumps(error, indent=2)}

Determine whether the failure is caused by:

1. BAD_TEST
   The generated test is incorrect, unreliable, or has an invalid expectation.

2. CODE_FAILURE
   The source code is incorrect and the test correctly detected a bug.

3. UNKNOWN
   There is not enough information to determine the cause.

Return ONLY valid JSON:

{{
    "classification": "BAD_TEST | CODE_FAILURE | UNKNOWN",
    "reason": "...",
    "recommended_action": "REGENERATE_TEST | FIX_CODE | STOP"
}}

Rules:
- Do not guess.
- Carefully compare the source code, test and error.
- For floating-point comparisons, consider floating-point precision.
- Do not classify a valid test as BAD_TEST just because the code fails it.
"""

    response = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt
    )

    return response.output_text

