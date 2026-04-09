"use client";

import { useCallback, useState } from "react";
import { downloadBase64File } from "@/lib/pipeline/download";
import {
  PipelineError,
  runChunkedPipeline,
  type StepResponseInfo,
} from "@/lib/pipeline/client";
import { sanitizeForStepDisplay } from "@/lib/pipeline/sanitize-display";
import type { PipelineState, PipelineStepId } from "@/lib/pipeline/types";
import { PIPELINE_STEPS } from "@/lib/pipeline/types";

type Phase = "idle" | "running" | "done" | "error";

export function PipelineApp() {
  const [practiceName, setPracticeName] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [radiusMi, setRadiusMi] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [state, setState] = useState<PipelineState | null>(null);
  const [stepOutcomes, setStepOutcomes] = useState<
    Partial<Record<PipelineStepId, StepResponseInfo>>
  >({});
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toISOString().slice(11, 23)} ${line}`]);
  }, []);

  const run = useCallback(async () => {
    const name = practiceName.trim();
    if (!name) {
      setError("Enter a practice name.");
      return;
    }

    setError(null);
    setLog([]);
    setState(null);
    setStepOutcomes({});
    setPhase("running");
    setCurrentStep(null);

    const radiusParsed = radiusMi.trim();
    const cityTrim = city.trim();
    const stateTrim = stateRegion.trim();
    const input = {
      practiceName: name,
      ...(radiusParsed !== ""
        ? { radiusMi: Number.parseFloat(radiusParsed) }
        : {}),
      ...(cityTrim !== "" ? { city: cityTrim } : {}),
      ...(stateTrim !== "" ? { state: stateTrim } : {}),
    };

    if (radiusParsed !== "" && Number.isNaN(input.radiusMi)) {
      setPhase("error");
      setError("Radius must be a number (e.g. 5 or 10).");
      return;
    }

    try {
      const finalState = await runChunkedPipeline(input, {
        onProgress: ({ step }) => {
          setCurrentStep(step);
          appendLog(`completed step: ${step}`);
        },
        onStepResponse: (info) => {
          setStepOutcomes((prev) => ({ ...prev, [info.step]: info }));
        },
      });
      setState(finalState);
      setPhase("done");
      appendLog("pipeline finished");
    } catch (e) {
      setPhase("error");
      const msg =
        e instanceof PipelineError
          ? `${e.step}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
      appendLog(`ERROR: ${msg}`);
    } finally {
      setCurrentStep(null);
    }
  }, [practiceName, city, stateRegion, radiusMi, appendLog]);

  const download = useCallback(() => {
    const r = state?.render;
    if (!r?.base64) return;
    downloadBase64File(r.fileName, r.mimeType, r.base64);
  }, [state]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Practice Visibility Scan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Client-orchestrated pipeline: each step POSTs the accumulated{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            state
          </code>{" "}
          to a separate serverless route (see{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            /api/pipeline/*
          </code>
          ).
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2">
          <label htmlFor="practice" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Practice name
          </label>
          <input
            id="practice"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="e.g. Acme Podiatry"
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            disabled={phase === "running"}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="city" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            City, optional
          </label>
          <input
            id="city"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="e.g. Cleveland"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={phase === "running"}
            autoComplete="address-level2"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="state" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            State, optional
          </label>
          <input
            id="state"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="e.g. OH"
            value={stateRegion}
            onChange={(e) => setStateRegion(e.target.value)}
            disabled={phase === "running"}
            autoComplete="address-level1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="radius" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Scan radius (miles), optional
          </label>
          <input
            id="radius"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Leave empty to use server default stub"
            value={radiusMi}
            onChange={(e) => setRadiusMi(e.target.value)}
            disabled={phase === "running"}
          />
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={phase === "running"}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {phase === "running" ? "Running…" : "Run pipeline"}
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Steps
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Expand a step to see the HTTP status and JSON body returned from{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">
            /api/pipeline/…
          </code>{" "}
          (including errors).
        </p>
        <ol className="flex flex-col gap-2">
          {PIPELINE_STEPS.map((id) => {
            const outcome = stepOutcomes[id];
            const b = outcome?.body;
            const done =
              state &&
              (id === "resolve"
                ? state.resolve
                : id === "scans"
                  ? state.scans
                  : id === "retrieve-reports"
                    ? state.retrieveReports
                    : id === "analyze-scan"
                      ? state.analyzeScan
                      : id === "website"
                        ? state.website
                        : id === "demographics"
                          ? state.demographics
                          : state.render);
            const active = currentStep === id;
            const parseErr =
              !!b && "parseError" in b && b.parseError === true;
            const apiErr = !!b && "ok" in b && b.ok === false;

            return (
              <li key={id}>
                <details className="group rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <summary
                    className={`flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden ${
                      active
                        ? "bg-amber-50 dark:bg-amber-950/40"
                        : done
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30"
                          : ""
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-emerald-600 text-white"
                          : active
                            ? "bg-amber-500 text-white"
                            : "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
                      }`}
                    >
                      {done ? "✓" : active ? "…" : ""}
                    </span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                      {id}
                    </span>
                    {outcome ? (
                      <span
                        className={`ml-auto text-xs font-medium tabular-nums ${
                          parseErr
                            ? "text-amber-700 dark:text-amber-400"
                            : apiErr
                              ? "text-red-700 dark:text-red-400"
                              : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        HTTP {outcome.httpStatus}
                        {parseErr
                          ? " · parse error"
                          : apiErr
                            ? " · error"
                            : " · ok"}
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-zinc-400">—</span>
                    )}
                    <span className="inline-block text-zinc-400 transition-transform group-open:rotate-90">
                      ▸
                    </span>
                  </summary>
                  <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    {outcome ? (
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-100/80 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        {JSON.stringify(
                          sanitizeForStepDisplay(outcome.body),
                          null,
                          2,
                        )}
                      </pre>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        No response yet (pending or not run).
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}

      {phase === "done" && state?.render && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={download}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Download {state.render.fileName}
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Log
        </h2>
        <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {log.length === 0 ? "—" : log.join("\n")}
        </pre>
      </section>
    </div>
  );
}
