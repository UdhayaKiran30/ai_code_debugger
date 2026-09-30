from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from debugger import analyze_error
from ai_debugger import debug_code
from executor import execute_code

from test_generator import generate_tests
from test_executor import execute_tests
from verification_service import verify_code


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CodeRequest(BaseModel):
    code: str


@app.get("/")
def root():
    return {"message": "AI Code Debugger API is running"}


@app.post("/api/code/run")
def run_code(request: CodeRequest):

    # 1. Execute code inside Docker
    result = execute_code(request.code)

    # 2. Analyze error
    error_info = analyze_error(result["stderr"])

    # 3. Ask AI for debugging help if code failed
    ai_analysis = None

    if result["status"] == "error":
        ai_analysis = debug_code(
            code=request.code,
            stdout=result["stdout"],
            stderr=result["stderr"],
            error_info=error_info
        )

    # 4. Return everything to frontend
    return {
        "status": result["status"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        "exit_code": result["exit_code"],
        "error": error_info,
        "ai_analysis": ai_analysis
    }

@app.post("/api/code/test")
def generate_and_run_tests(request: CodeRequest):

    # 1. Generate tests using Gemini
    generated_tests = generate_tests(request.code)

    # 2. Execute tests inside Docker
    test_result = execute_tests(
        code=request.code,
        tests=generated_tests
    )

    # 3. Return results
    return {
        "status": test_result["status"],
        "tests": generated_tests,
        "stdout": test_result["stdout"],
        "stderr": test_result["stderr"],
        "exit_code": test_result["exit_code"]
    }

@app.post("/api/code/verify")
def verify_code_endpoint(request: CodeRequest):

    result = verify_code(request.code)

    return result