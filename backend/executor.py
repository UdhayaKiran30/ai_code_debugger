import os
import tempfile
import subprocess


def execute_code(code: str):
    temp_dir = tempfile.mkdtemp()

    try:
        code_file = os.path.join(temp_dir, "main.py")

        with open(code_file, "w", encoding="utf-8") as f:
            f.write(code)

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
                "/app/main.py"
            ],
            capture_output=True,
            text=True,
            timeout=15
        )

        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "status": "success" if result.returncode == 0 else "error"
        }

    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": "Execution timed out.",
            "exit_code": -1,
            "status": "timeout"
        }

    finally:
        try:
            os.remove(code_file)
            os.rmdir(temp_dir)
        except:
            pass