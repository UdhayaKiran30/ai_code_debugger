import os
import re
import tempfile
import subprocess


def parse_test_error(stderr: str):

    if not stderr:
        return {
            "has_error": False,
            "error_type": None,
            "error_line": None,
            "error_message": None
        }

    # Find line number
    line_match = re.search(
        r'File "/app/test_main\.py", line (\d+)',
        stderr
    )

    # Find Python error type and message
    error_match = re.search(
        r"([A-Za-z_][A-Za-z0-9_]*Error): (.+)",
        stderr
    )

    error_line = None
    error_type = None
    error_message = None

    if line_match:
        error_line = int(line_match.group(1))

    if error_match:
        error_type = error_match.group(1)
        error_message = error_match.group(2)

    return {
        "has_error": True,
        "error_type": error_type,
        "error_line": error_line,
        "error_message": error_message
    }


def execute_tests(code: str, tests: str):

    temp_dir = tempfile.mkdtemp()

    try:
        test_file = os.path.join(temp_dir, "test_main.py")

        # Remove Markdown code fences from Gemini response
        tests = (
            tests
            .replace("```python", "")
            .replace("```", "")
            .strip()
        )

        # Combine source code and generated tests
        full_test_code = f"""
{code}


# =========================
# GENERATED TESTS
# =========================

{tests}
"""

        with open(test_file, "w", encoding="utf-8") as f:
            f.write(full_test_code)

        result = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--network", "none",
                "--memory", "128m",
                "--cpus", "0.5",
                "-v",
                f"{temp_dir}:/app:ro",
                "python:3.12-slim",
                "python",
                "/app/test_main.py"
            ],
            capture_output=True,
            text=True,
            timeout=15
        )

        error_info = parse_test_error(result.stderr)

        return {
            "status": "passed" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "error": error_info
        }

    except subprocess.TimeoutExpired:

        return {
            "status": "timeout",
            "stdout": "",
            "stderr": "Test execution timed out.",
            "exit_code": -1,
            "error": {
                "has_error": True,
                "error_type": "TimeoutError",
                "error_line": None,
                "error_message": "Test execution timed out."
            }
        }

    finally:

        try:
            os.remove(test_file)
            os.rmdir(temp_dir)
        except:
            pass

