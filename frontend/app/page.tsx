"use client";

import { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";

const API = "http://localhost:8000/api/code";

/* ---------------- types ---------------- */

interface DebugResult {
  root_cause: string;
  explanation: string;
  suggested_fix: string;
  corrected_code: string;
}

interface RunResponse {
  status: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  error?: {
    has_error: boolean;
    error_type: string | null;
    error_message: string | null;
    error_line: number | null;
  };
  ai_analysis: string | null;
}

interface Attempt {
  attempt: number;
  tests: string;
  result: { status: string; stdout: string; stderr: string };
}

interface VerifyResponse {
  status: string;
  code: string;
  attempts: number;
  history: Attempt[];
  analysis?: {
    classification: string;
    reason: string;
    recommended_action: string;
  };
}

type Tab = "output" | "analysis" | "tests";
type FixState = "idle" | "checking" | "passed" | "failed";

/* ---------------- helpers ---------------- */

async function post<T>(path: string, code: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

// AI output is sometimes wrapped in ```json fences — strip them before parsing.
function parseAnalysis(raw: string | null): DebugResult | null {
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// Split "a, b(1, 2), 'x,y'" on top-level commas only.
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", cur = "";
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface Case { input: string; output: string }

// Turns generated test code into {input, expected output} rows.
function parseTests(src: string): Case[] {
  const cases: Case[] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^assert\s+(.+?)\s+==\s+(.+?)(?:\s*,\s*(?:f?["']).*)?$/))) {
      cases.push({ input: m[1], output: m[2] });
    } else if ((m = line.match(/^(?:self\.)?assertEqual\((.+)\)\s*$/))) {
      const a = splitArgs(m[1]);
      if (a.length >= 2) cases.push({ input: a[0], output: a[1] });
    } else if ((m = line.match(/^(?:self\.)?assertTrue\((.+)\)\s*$/))) {
      cases.push({ input: splitArgs(m[1])[0], output: "True" });
    } else if ((m = line.match(/^(?:self\.)?assertFalse\((.+)\)\s*$/))) {
      cases.push({ input: splitArgs(m[1])[0], output: "False" });
    } else if ((m = line.match(/^assert\s+not\s+(.+)$/))) {
      cases.push({ input: m[1], output: "False" });
    } else if ((m = line.match(/^assert\s+(.+)$/))) {
      cases.push({ input: m[1], output: "True" });
    }
  }
  return cases;
}

/* ---------------- small UI pieces ---------------- */

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function Chip({ tone, children }: { tone: "ok" | "bad" | "warn" | "mute"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
    bad: "bg-rose-400/10 text-rose-300 border-rose-400/30",
    warn: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    mute: "bg-white/5 text-slate-400 border-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Section({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="border-l-2 pl-4" style={{ borderColor: tone }}>
      <h3 className="text-sm font-semibold" style={{ color: tone }}>{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{children}</p>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-center text-sm text-slate-500">{children}</p>;
}

/* ---------------- page ---------------- */

export default function Home() {
  const [code, setCode] = useState(`a = 10\nb = 0\n\nprint(a / b)`);

  const [tab, setTab] = useState<Tab>("output");
  const [output, setOutput] = useState<{ text: string; ok: boolean } | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ type: string; line: number | null } | null>(null);
  const [debug, setDebug] = useState<DebugResult | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState<string | null>(null);
  const [fixState, setFixState] = useState<FixState>("idle");
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [activeAttempt, setActiveAttempt] = useState(0);

  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null); // connection / server errors, shown inline
  const busy = running || verifying || fixState === "checking";

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const runRef = useRef<() => void>(() => { });

  /* red squiggle on the failing line */
  const mark = (line: number | null, message = "") => {
    const model = editorRef.current?.getModel();
    const monaco = monacoRef.current;
    if (!model || !monaco) return;
    monaco.editor.setModelMarkers(
      model,
      "debugger",
      line
        ? [{
          severity: monaco.MarkerSeverity.Error,
          message,
          startLineNumber: line,
          endLineNumber: line,
          startColumn: 1,
          endColumn: model.getLineMaxColumn(Math.min(line, model.getLineCount())),
        }]
        : []
    );
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  /* ---------- actions ---------- */

  const runCode = async (source = code) => {
    setRunning(true);
    setNotice(null);
    setVerify(null);
    setDebug(null);
    setRawAnalysis(null);
    setErrorInfo(null);
    setFixState("idle");
    mark(null);

    try {
      const data = await post<RunResponse>("run", source);
      const ok = data.status === "success";
      setOutput({ text: ok ? data.stdout : data.stderr || data.stdout, ok });

      if (ok) {
        setTab("output");
        return;
      }

      const line = data.error?.error_line ?? null;
      setErrorInfo({ type: data.error?.error_type || "Runtime error", line });
      mark(line, data.error?.error_message || "");

      const parsed = parseAnalysis(data.ai_analysis);
      setDebug(parsed);
      setRawAnalysis(parsed ? null : data.ai_analysis);
      setTab(parsed || data.ai_analysis ? "analysis" : "output");
    } catch (e) {
      console.error(e);
      setNotice("Can't reach the backend at localhost:8000. Start the server and run again.");
    } finally {
      setRunning(false);
    }
  };
  runRef.current = () => { if (!busy) runCode(); };

  const applyFix = async () => {
    if (!debug?.corrected_code) return;
    const fixed = debug.corrected_code;
    setCode(fixed);
    mark(null);
    setFixState("checking");
    setNotice(null);

    try {
      const data = await post<RunResponse>("run", fixed);
      const ok = data.status === "success";
      setOutput({ text: ok ? data.stdout : data.stderr || data.stdout, ok });
      setFixState(ok ? "passed" : "failed");
      if (ok) setErrorInfo(null);
    } catch (e) {
      console.error(e);
      setFixState("idle");
      setNotice("Couldn't verify the fix — the backend didn't respond.");
    }
  };

  const verifyCode = async () => {
    setVerifying(true);
    setNotice(null);
    setVerify(null);
    try {
      const data = await post<VerifyResponse>("verify", code);
      setVerify(data);
      setActiveAttempt(Math.max(0, data.history.length - 1));
      setTab("tests");
    } catch (e) {
      console.error(e);
      setNotice("Test generation failed. Check that the backend is running.");
    } finally {
      setVerifying(false);
    }
  };

  /* ---------- derived ---------- */

  const attempt = verify?.history[activeAttempt];
  const cases = attempt ? parseTests(attempt.tests) : [];
  const passed = (a: Attempt) => a.result.status === "passed";

  const tabs: { id: Tab; label: string; badge?: React.ReactNode }[] = [
    { id: "output", label: "Output", badge: output && <span className={`h-1.5 w-1.5 rounded-full ${output.ok ? "bg-emerald-400" : "bg-rose-400"}`} /> },
    { id: "analysis", label: "AI analysis", badge: (debug || rawAnalysis) && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> },
    { id: "tests", label: "Tests", badge: verify && <span className={`h-1.5 w-1.5 rounded-full ${verify.status === "verified" ? "bg-emerald-400" : "bg-amber-400"}`} /> },
  ];

  const btn = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300";

  return (
    <main className="flex min-h-screen flex-col bg-[#12151c] text-slate-200">
      {/* header */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">AI Code Debugger</h1>
        <p className="hidden text-xs text-slate-500 sm:block">
          Press <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono">Ctrl</kbd>{" "}
          + <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono">Enter</kbd> to run
        </p>
      </header>

      {notice && (
        <div role="alert" className="flex items-center justify-between gap-4 border-b border-rose-400/30 bg-rose-400/10 px-6 py-2 text-sm text-rose-200">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-rose-300 underline">Dismiss</button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* ---------- editor ---------- */}
        <section className="flex flex-col border-white/10 lg:border-r">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
            <button onClick={() => runCode()} disabled={busy} className={`${btn} bg-teal-400 text-slate-900 hover:bg-teal-300`}>
              {running ? <Spinner /> : "▶"} {running ? "Running" : "Run"}
            </button>
            <button onClick={verifyCode} disabled={busy} className={`${btn} border border-white/15 hover:bg-white/5`}>
              {verifying ? <Spinner /> : "🧪"} {verifying ? "Generating tests" : "Generate tests"}
            </button>
            {errorInfo?.line && (
              <span className="ml-auto text-xs text-rose-300">
                {errorInfo.type} on line {errorInfo.line}
              </span>
            )}
          </div>
          <div className="min-h-[420px] flex-1">
            <Editor
              height="100%"
              defaultLanguage="python"
              value={code}
              onChange={(v) => { setCode(v || ""); if (errorInfo) mark(null); }}
              onMount={handleMount}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 15, padding: { top: 12 }, scrollBeyondLastLine: false }}
            />
          </div>
        </section>

        {/* ---------- results ---------- */}
        <section className="flex min-h-[420px] flex-col">
          <div role="tablist" className="flex gap-1 border-b border-white/10 px-4 pt-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${tab === t.id ? "border-teal-300 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
              >
                {t.label}
                {t.badge}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-5">
            {/* OUTPUT */}
            {tab === "output" &&
              (output ? (
                <div className="space-y-3">
                  <Chip tone={output.ok ? "ok" : "bad"}>{output.ok ? "Finished without errors" : "Finished with an error"}</Chip>
                  <pre className="whitespace-pre-wrap rounded-lg bg-black/60 p-4 font-mono text-sm text-slate-200">
                    {output.text || "(no output)"}
                  </pre>
                </div>
              ) : (
                <Empty>Run your code to see what it prints here.</Empty>
              ))}

            {/* ANALYSIS */}
            {tab === "analysis" &&
              (debug ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-rose-300">{errorInfo?.type || "Runtime error"}</h2>
                    {errorInfo?.line && <p className="text-sm text-slate-500">Line {errorInfo.line}</p>}
                  </div>

                  <Section title="Root cause" tone="#fbbf24">{debug.root_cause}</Section>
                  <Section title="Why it happens" tone="#60a5fa">{debug.explanation}</Section>
                  <Section title="Suggested fix" tone="#34d399">{debug.suggested_fix}</Section>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Corrected code</h3>
                    <pre className="overflow-x-auto rounded-lg bg-black/60 p-4 font-mono text-sm">{debug.corrected_code}</pre>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={applyFix} disabled={busy} className={`${btn} bg-emerald-500 text-slate-950 hover:bg-emerald-400`}>
                      {fixState === "checking" && <Spinner />}
                      {fixState === "checking" ? "Checking fix" : "Apply and verify fix"}
                    </button>
                    {fixState === "passed" && <Chip tone="ok">Fix verified — code runs cleanly</Chip>}
                    {fixState === "failed" && <Chip tone="bad">Fix still fails — see Output</Chip>}
                  </div>
                </div>
              ) : rawAnalysis ? (
                <div className="space-y-3">
                  <Chip tone="warn">Analysis came back unstructured</Chip>
                  <pre className="whitespace-pre-wrap rounded-lg bg-black/60 p-4 text-sm text-slate-300">{rawAnalysis}</pre>
                </div>
              ) : (
                <Empty>When your code fails, the AI explains why and proposes a fix here.</Empty>
              ))}

            {/* TESTS — input & expected output only */}
            {tab === "tests" &&
              (verify && attempt ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Chip tone={verify.status === "verified" ? "ok" : "warn"}>
                      {verify.status === "verified" ? "Code verified" : "Not verified"} · {verify.attempts}{" "}
                      {verify.attempts === 1 ? "attempt" : "attempts"}
                    </Chip>
                    {verify.code && verify.code !== code && (
                      <button onClick={() => setCode(verify.code)} className="text-sm text-teal-300 underline">
                        Load verified code into editor
                      </button>
                    )}
                  </div>

                  {verify.history.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {verify.history.map((h, i) => (
                        <button
                          key={h.attempt}
                          onClick={() => setActiveAttempt(i)}
                          className={`rounded-md border px-3 py-1 text-xs transition ${i === activeAttempt ? "border-teal-300 text-white" : "border-white/10 text-slate-500 hover:text-slate-300"
                            }`}
                        >
                          Attempt {h.attempt} {passed(h) ? "✓" : "✗"}
                        </button>
                      ))}
                    </div>
                  )}

                  {cases.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs text-slate-400">
                          <tr>
                            <th className="w-10 px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Input</th>
                            <th className="px-3 py-2 font-medium">Output</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {cases.map((c, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                              <td className="px-3 py-2 text-slate-200">{c.input}</td>
                              <td className={`px-3 py-2 ${passed(attempt) ? "text-emerald-300" : "text-rose-300"}`}>{c.output}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No test cases could be read from this attempt.</p>
                  )}

                  {verify.analysis && (
                    <Section title={`Why it failed: ${verify.analysis.classification}`} tone="#fb7185">
                      {verify.analysis.reason}{" "}
                      <span className="text-slate-400">{verify.analysis.recommended_action}</span>
                    </Section>
                  )}
                </div>
              ) : (
                <Empty>Generate tests to see each case's input and output.</Empty>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}