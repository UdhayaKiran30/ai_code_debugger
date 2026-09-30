import re


def analyze_error(stderr: str):

    if not stderr:
        return {
            "has_error": False,
            "error_type": None,
            "error_message": None,
            "error_line": None,
        }

    error_match = re.search(
        r"([A-Za-z_][A-Za-z0-9_]*Error): (.+)",
        stderr
    )

    line_match = re.search(
        r'File "/app/main.py", line (\d+)',
        stderr
    )

    error_type = None
    error_message = None
    error_line = None

    if error_match:
        error_type = error_match.group(1)
        error_message = error_match.group(2)

    if line_match:
        error_line = int(line_match.group(1))

    return {
        "has_error": True,
        "error_type": error_type,
        "error_message": error_message,
        "error_line": error_line,
    }