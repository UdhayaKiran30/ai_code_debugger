import os
import json

from dotenv import load_dotenv
from google import genai


load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def debug_code(
    code: str,
    stdout: str,
    stderr: str,
    error_info: dict
):

    prompt = f"""
You are an expert software debugging assistant.

Analyze the following code execution.

SOURCE CODE:
{code}

STANDARD OUTPUT:
{stdout}

ERROR OUTPUT:
{stderr}

ERROR INFORMATION:
{json.dumps(error_info, indent=2)}

Return your response ONLY as valid JSON with this structure:

{{
    "root_cause": "...",
    "explanation": "...",
    "suggested_fix": "...",
    "corrected_code": "..."
}}

Do not invent errors that are not present.
Preserve the original programming language.
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )

    return response.text