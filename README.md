# 🤖 AI Code Debugger

An AI-powered web-based code debugging and verification platform that safely executes Python code inside a Docker sandbox, analyzes runtime errors using Gemini, generates automated test cases, detects test failures, and verifies fixes through an automated testing workflow.

---

## 🚀 Overview

AI Code Debugger combines code execution, AI-powered debugging, automated test generation, and isolated test execution into a single web-based development environment.

The system allows a developer to:

* Write Python code using Monaco Editor
* Execute code safely inside a Docker sandbox
* Capture `stdout`, `stderr`, exit codes, and runtime errors
* Extract structured error information
* Analyze errors using Google Gemini
* Generate automated test cases using AI
* Execute generated tests inside Docker
* Analyze failed tests using AI
* Distinguish between bad tests and actual code failures
* Automatically retry verification when generated tests are unreliable
* Apply AI-generated fixes and verify the corrected code

---

## ✨ Key Features

### 💻 Monaco Code Editor

A browser-based code editor powered by Monaco Editor with:

* Syntax highlighting
* Python support
* Dark theme
* Code editing
* Real-time interaction

### 🐳 Docker Code Sandbox

User-submitted code is not executed directly inside the FastAPI server.

Instead:

```text
User Code
    ↓
FastAPI
    ↓
Docker Container
    ↓
Python Execution
    ↓
stdout / stderr / exit code
```

The Docker execution environment currently uses restrictions such as:

* No network access
* CPU limits
* Memory limits
* Temporary containers
* Read-only code mounting
* Execution timeout

This provides an isolated environment for executing untrusted code.

### 🧠 AI Debugging

When code fails, the execution error is passed to Gemini along with the source code and structured error information.

The AI produces:

* Root cause
* Explanation
* Suggested fix
* Corrected code

Example workflow:

```text
Python Code
     ↓
Docker Execution
     ↓
Runtime Error
     ↓
Error Extraction
     ↓
Gemini
     ↓
Root Cause
Explanation
Suggested Fix
Corrected Code
```

### 🧪 AI Test Generation

Gemini analyzes the source code and generates tests covering:

* Normal inputs
* Edge cases
* Boundary cases
* Invalid inputs where applicable
* Previously identified bugs

Generated tests are executed automatically.

### 🔍 AI Test Failure Analysis

If an automatically generated test fails, Gemini analyzes the failure and classifies it as:

```text
BAD_TEST
CODE_FAILURE
UNKNOWN
```

The system can then determine whether to:

* Regenerate the test
* Investigate the source code
* Stop the verification process

### 🔄 Automatic Verification Loop

The project includes an automated verification workflow with a maximum retry limit.

```text
Generate Tests
      ↓
Run Tests
      ↓
   Passed?
   /     \
 YES      NO
 ↓         ↓
Verified   AI Failure Analyzer
              ↓
        ┌─────┴─────┐
        ↓           ↓
    BAD_TEST   CODE_FAILURE
        ↓           ↓
 Regenerate      Investigate
    Tests         Code
        ↓
    Run Again
```

The verification process is limited to a maximum number of attempts to avoid infinite retries.

---

## 🏗️ System Architecture

```text
                    ┌──────────────────┐
                    │   Monaco Editor  │
                    │    Next.js UI    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     FastAPI      │
                    │     Backend      │
                    └────────┬─────────┘
                             │
             ┌───────────────┴────────────────┐
             │                                │
             ▼                                ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ Docker Sandbox  │              │  Gemini AI      │
    │                 │              │                 │
    │ Code Execution  │              │ Debugging       │
    │ Test Execution  │              │ Test Generation │
    └────────┬────────┘              │ Failure Analysis│
             │                       └────────┬────────┘
             │                                │
             └───────────────┬────────────────┘
                             ▼
                    ┌──────────────────┐
                    │ Verification     │
                    │ Service          │
                    └──────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Monaco Editor

### Backend

* Python
* FastAPI
* Uvicorn

### AI

* Google Gemini API
* AI-powered debugging
* AI test generation
* AI test failure analysis

### Code Execution

* Docker
* Python 3.12 sandbox containers

### Development Tools

* Git
* GitHub
* VS Code
* Postman

---

## 📂 Project Structure

```text
ai-code-debugger/
│
├── backend/
│   ├── main.py
│   ├── debugger.py
│   ├── ai_debugger.py
│   ├── test_generator.py
│   ├── test_executor.py
│   ├── test_analyzer.py
│   ├── verification_service.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx
│   │       ├── layout.tsx
│   │       └── globals.css
│   ├── package.json
│   └── ...
│
├── sandbox/
│   ├── Dockerfile
│   └── run.py
│
├── .gitignore
└── README.md
```

> `backend/.env` contains the Gemini API key and should never be committed to GitHub.

---

## ⚙️ Prerequisites

Install the following before running the project:

* Python 3.12+
* Node.js
* npm
* Docker Desktop
* Git
* Gemini API key

---

## 🔑 Environment Variables

Create:

```text
backend/.env
```

Add:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Never commit your actual API key to GitHub.

---

## 🔧 Backend Setup

Open PowerShell:

```powershell
cd D:\projects\ai_code_debugger\backend
```

Create a virtual environment:

```powershell
python -m venv venv
```

Activate it:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Start FastAPI:

```powershell
uvicorn main:app --reload
```

Backend will be available at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

## 🎨 Frontend Setup

Open another PowerShell terminal:

```powershell
cd D:\projects\ai_code_debugger\frontend
```

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🐳 Docker Setup

Make sure Docker Desktop is running.

The backend creates temporary Docker containers for code and test execution.

Example execution restrictions include:

```text
--network none
--memory 128m
--cpus 0.5
--rm
```

The container is removed after execution.

---

## 🔄 Application Workflow

### 1. Run Code

The developer enters Python code and clicks:

```text
▶ Run Code
```

The backend sends the code to the Docker sandbox.

---

### 2. Error Detection

If execution fails, the backend extracts information such as:

```json
{
  "has_error": true,
  "error_type": "ZeroDivisionError",
  "error_message": "division by zero",
  "error_line": 3
}
```

---

### 3. AI Debugging

The source code, execution output, and error information are sent to Gemini.

The AI returns:

```text
Root Cause
Explanation
Suggested Fix
Corrected Code
```

---

### 4. Apply & Verify Fix

The developer can apply the AI-generated corrected code.

The corrected code is executed again inside Docker.

```text
AI Fix
  ↓
Monaco Editor
  ↓
Docker
  ↓
Execution
  ↓
Verification
```

---

### 5. Generate & Verify Tests

The developer can request automated tests.

```text
Source Code
    ↓
Gemini Test Generator
    ↓
Generated Tests
    ↓
Docker
    ↓
Test Result
```

---

### 6. Analyze Test Failures

If a generated test fails:

```text
Test Failure
     ↓
Gemini Failure Analyzer
     ↓
BAD_TEST / CODE_FAILURE / UNKNOWN
```

The verification service can retry test generation when appropriate.

---

## 🧪 Example

Input:

```python
a = 10
b = 0

print(a / b)
```

Execution produces:

```text
ZeroDivisionError: division by zero
```

The AI debugger identifies the division-by-zero issue and can generate corrected code.

The corrected code can then be executed again and verified.

---

## 🔐 Security Considerations

Executing arbitrary code is security-sensitive.

This project uses Docker to avoid directly executing submitted code inside the FastAPI process.

Current sandbox controls include:

* Network isolation
* Memory limits
* CPU limits
* Execution timeout
* Temporary containers
* Read-only code mount

For a production deployment, additional sandbox hardening would be required, including stronger process isolation, capability restrictions, non-root execution, PID limits, filesystem restrictions, output limits, and other container security controls.

---

## 📈 Current Development Status

### Completed

* [x] Next.js frontend
* [x] Monaco code editor
* [x] FastAPI backend
* [x] Docker code execution
* [x] Runtime error extraction
* [x] Gemini AI debugging
* [x] AI-generated corrected code
* [x] Apply & verify fix
* [x] AI test generation
* [x] Docker test execution
* [x] Structured test failure parsing
* [x] AI test failure analysis
* [x] Automatic verification loop
* [x] FastAPI verification endpoint

### Planned

* [ ] Harden Docker sandbox
* [ ] Improve generated-test validation
* [ ] Structured AI responses
* [ ] Better test result reporting
* [ ] LangGraph multi-agent workflow
* [ ] PostgreSQL debugging history
* [ ] User authentication
* [ ] Deployment
* [ ] Support for additional programming languages

---

## 🔮 Future Architecture

The project is planned to evolve toward a multi-agent debugging workflow:

```text
                User Code
                    │
                    ▼
              Error Agent
                    │
                    ▼
               Fix Agent
                    │
                    ▼
               Test Agent
                    │
                    ▼
          Verification Agent
                    │
              ┌─────┴─────┐
              │           │
            PASS        FAILURE
              │           │
              ▼           ▼
            Done       Retry Loop
```

LangGraph can later be used to orchestrate these agents and manage state between debugging, fixing, testing, and verification steps.

---

## 🎯 Project Goals

The main goal of this project is to explore how AI can be integrated into a software development workflow rather than simply generating code.

The system focuses on:

* Automated debugging
* Safe code execution
* AI-assisted testing
* Failure analysis
* Automated verification
* Iterative debugging workflows

---

## 👨‍💻 Author

**Udhaya Kiran M V**

B.E. Computer Science and Engineering — 2026

GitHub: https://github.com/UdhayaKiran30

LinkedIn: https://www.linkedin.com/in/udhayakiran/

---

## 📄 License

This project is intended for educational and portfolio purposes.
