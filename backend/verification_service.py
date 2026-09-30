from test_generator import generate_tests
from test_executor import execute_tests
from test_analyzer import analyze_test_failure


MAX_ATTEMPTS = 3


def verify_code(code: str):

    current_code = code
    history = []

    for attempt in range(1, MAX_ATTEMPTS + 1):

        print(f"\n========== ATTEMPT {attempt} ==========")

        # --------------------------------
        # 1. Generate tests
        # --------------------------------

        print("Generating tests...")

        tests = generate_tests(current_code)

        # --------------------------------
        # 2. Execute tests
        # --------------------------------

        print("Running tests...")

        test_result = execute_tests(
            current_code,
            tests
        )

        history.append({
            "attempt": attempt,
            "tests": tests,
            "result": test_result
        })

        # --------------------------------
        # 3. Tests passed
        # --------------------------------

        if test_result["status"] == "passed":

            print("✅ All tests passed.")

            return {
                "status": "verified",
                "code": current_code,
                "attempts": attempt,
                "history": history
            }

        # --------------------------------
        # 4. Tests failed
        # --------------------------------

        print("❌ Tests failed.")

        # --------------------------------
        # 5. Analyze failure
        # --------------------------------

        analysis = analyze_test_failure(
            current_code,
            tests,
            test_result["error"]
        )

        print("AI Failure Analysis:")
        print(analysis)

        # --------------------------------
        # 6. Parse AI response
        # --------------------------------

        import json

        try:
            analysis_data = json.loads(analysis)
        except json.JSONDecodeError:

            return {
                "status": "analysis_error",
                "code": current_code,
                "attempts": attempt,
                "history": history,
                "analysis": analysis
            }

        classification = analysis_data.get(
            "classification"
        )

        recommended_action = analysis_data.get(
            "recommended_action"
        )

        # --------------------------------
        # 7. Decide what to do
        # --------------------------------

        if classification == "BAD_TEST":

            print("⚠️ AI detected a bad test.")

            if recommended_action == "REGENERATE_TEST":
                print("Regenerating tests...")
                continue

        elif classification == "CODE_FAILURE":

            print("🐛 AI detected a code failure.")

            return {
                "status": "code_failure",
                "code": current_code,
                "attempts": attempt,
                "history": history,
                "analysis": analysis_data
            }

        elif classification == "UNKNOWN":

            print("❓ Unable to determine failure cause.")

            return {
                "status": "unknown",
                "code": current_code,
                "attempts": attempt,
                "history": history,
                "analysis": analysis_data
            }

    # --------------------------------
    # Maximum attempts reached
    # --------------------------------

    return {
        "status": "max_attempts_reached",
        "code": current_code,
        "attempts": MAX_ATTEMPTS,
        "history": history
    }

