import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def generate_tests(code: str):

    prompt = f"""
You are an expert Python test engineer.

Analyze the following Python code and generate reliable, executable test cases.

SOURCE CODE:
{code}

Generate tests covering:

1. Normal inputs
2. Edge cases
3. Boundary cases
4. Invalid inputs where applicable
5. The bug that was previously fixed

IMPORTANT TESTING RULES:

- Return ONLY executable Python test code.
- Do not use pytest, unittest, or any external testing framework.
- Standard Python libraries such as math are allowed.
- Use simple assert statements.
- Make sure every generated test is compatible with the provided source code.
- Do not generate mathematically incorrect expected values.
- Do not use exact == comparisons for floating-point calculations when precision can be an issue.
- For floating-point results, use math.isclose() with an appropriate tolerance.
- Avoid unnecessarily extreme floating-point values unless they are relevant to the code.
- Tests must be deterministic.
- Do not modify the source code.
- Test the original bug or edge case that was fixed.

Example:

import math

assert divide(10, 2) == 5

assert math.isclose(
    divide(1, 3),
    1 / 3,
    rel_tol=1e-9
)

Return ONLY the test code.

SOURCE CODE:
{code}
"""

    response = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt
    )

    return response.output_text

