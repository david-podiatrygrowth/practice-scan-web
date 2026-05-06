"use client";

import { useCallback, useMemo, useState } from "react";
import { downloadBase64File } from "@/lib/pipeline/download";
import {
  PipelineError,
  runPipelineSteps,
  type StepResponseInfo,
} from "@/lib/pipeline/client";
import { sanitizeForStepDisplay } from "@/lib/pipeline/sanitize-display";
import { clampRadiusMi } from "@/lib/pipeline/radius-mi";
import type {
  PipelineState,
  PipelineStepId,
  RadiusResult,
} from "@/lib/pipeline/types";
import { PIPELINE_STEPS } from "@/lib/pipeline/types";

const RADIUS_STEP_INDEX = PIPELINE_STEPS.indexOf("radius");
const STEPS_THROUGH_RADIUS = PIPELINE_STEPS.slice(0, RADIUS_STEP_INDEX + 1);
const STEPS_AFTER_RADIUS = PIPELINE_STEPS.slice(RADIUS_STEP_INDEX + 1);

type Phase =
  | "idle"
  | "running"
  | "paused_after_radius"
  | "done"
  | "error";

export function PipelineApp() {
  const [practiceName, setPracticeName] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [radiusMi, setRadiusMi] = useState("");
  /** When enabled, pause after the radius step until you explicitly continue into scans. */
  const [pauseAfterRadius, setPauseAfterRadius] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [state, setState] = useState<PipelineState | null>(null);
  const [stepOutcomes, setStepOutcomes] = useState<
    Partial<Record<PipelineStepId, StepResponseInfo>>
  >({});
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Miles to use for scans when continuing from the radius pause (editable). */
  const [pausedRadiusDraft, setPausedRadiusDraft] = useState("");

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toISOString().slice(11, 23)} ${line}`]);
  }, []);

  const callbacks = useMemo(
    () => ({
      onProgress: ({ step }: { step: string }) => {
        setCurrentStep(step);
        appendLog(`completed step: ${step}`);
      },
      onStepResponse: (info: StepResponseInfo) => {
        setStepOutcomes((prev) => ({ ...prev, [info.step]: info }));
      },
    }),
    [appendLog],
  );

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
      const afterRadius = await runPipelineSteps(
        { input },
        STEPS_THROUGH_RADIUS,
        callbacks,
      );
      setState(afterRadius);

      if (pauseAfterRadius) {
        if (afterRadius.radius) {
          setPausedRadiusDraft(String(afterRadius.radius.radiusMi));
        }
        setPhase("paused_after_radius");
        appendLog("paused after radius — confirm and continue to scans when ready");
      } else {
        const finalState = await runPipelineSteps(
          afterRadius,
          STEPS_AFTER_RADIUS,
          callbacks,
        );
        setState(finalState);
        setPhase("done");
        appendLog("pipeline finished");
      }
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
  }, [
    practiceName,
    city,
    stateRegion,
    radiusMi,
    appendLog,
    callbacks,
    pauseAfterRadius,
  ]);

  const continueAfterRadius = useCallback(async () => {
    if (!state?.radius) return;

    const n = Number.parseFloat(pausedRadiusDraft.trim());
    if (!Number.isFinite(n)) {
      setError("Enter a valid number for scan radius (miles).");
      return;
    }

    const clamped = clampRadiusMi(n);
    const suggested = state.radius.radiusMi;
    const radiusAdjusted = Math.abs(clamped - suggested) >= 1e-6;
    const adjustedRadius: RadiusResult = radiusAdjusted
      ? {
          ...state.radius,
          radiusMi: clamped,
          method: "confirmation_override",
          rationale: `Radius set to ${clamped} mi in the confirmation step before scans (suggestion from the radius step was ${suggested} mi). ${state.radius.rationale}`,
        }
      : state.radius;

    const stateToContinue: PipelineState = radiusAdjusted
      ? { ...state, radius: adjustedRadius }
      : state;

    if (radiusAdjusted) {
      appendLog(
        `radius adjusted at confirmation: ${suggested} → ${clamped} mi`,
      );
    }
    if (clamped !== n) {
      appendLog(
        `radius clamped to allowed range (0.1–100 mi); using ${clamped} mi`,
      );
    }

    setError(null);
    setPhase("running");
    setCurrentStep(null);
    try {
      const finalState = await runPipelineSteps(
        stateToContinue,
        STEPS_AFTER_RADIUS,
        callbacks,
      );
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
  }, [state, pausedRadiusDraft, callbacks, appendLog]);

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
            disabled={phase === "running" || phase === "paused_after_radius"}
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
            disabled={phase === "running" || phase === "paused_after_radius"}
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
            disabled={phase === "running" || phase === "paused_after_radius"}
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
            placeholder="Leave empty to derive radius from Census county density"
            value={radiusMi}
            onChange={(e) => setRadiusMi(e.target.value)}
            disabled={phase === "running" || phase === "paused_after_radius"}
          />
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900/40">
          <input
            id="pause-after-radius"
            type="checkbox"
            checked={pauseAfterRadius}
            onChange={(e) => setPauseAfterRadius(e.target.checked)}
            disabled={phase === "running"}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-200"
          />
          <label htmlFor="pause-after-radius" className="text-sm leading-snug text-zinc-700 dark:text-zinc-300">
            Pause after the radius step before running scans so I can confirm the
            chosen radius. Turn this off once you trust the automatic
            density-based radius.
          </label>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={phase === "running" || phase === "paused_after_radius"}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {phase === "running" ? "Running…" : "Run pipeline"}
        </button>
      </section>

      {phase === "paused_after_radius" && state?.radius && (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/40"
          aria-live="polite"
        >
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Radius step complete — confirm before scans
          </h2>
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="paused-radius-override"
              className="text-sm font-medium text-amber-950 dark:text-amber-100"
            >
              Scan radius (miles) for Local Falcon
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="paused-radius-override"
                type="text"
                inputMode="decimal"
                aria-describedby="paused-radius-hint"
                className="w-28 rounded-lg border border-amber-300/80 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none ring-amber-700/40 focus:ring-2 dark:border-amber-800 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-amber-400/40"
                value={pausedRadiusDraft}
                onChange={(e) => setPausedRadiusDraft(e.target.value)}
              />
              <span id="paused-radius-hint" className="text-xs text-amber-900/75 dark:text-amber-200/75">
                Suggested:{" "}
                <span className="font-mono tabular-nums">
                  {state.radius.radiusMi} mi
                </span>
                . Edit if you want a different grid ring (values clamp to 0.1–100
                mi).
              </span>
            </div>
          </div>
          <dl className="mt-4 space-y-1 text-sm text-amber-950/90 dark:text-amber-100/90">
            {state.radius.countyName != null &&
            state.radius.countyDensityPerSqMi != null ? (
              <div>
                <dt className="inline font-medium">County context: </dt>
                <dd className="inline">
                  ~{Math.round(state.radius.countyDensityPerSqMi)} people/sq mi
                  {" — "}
                  {state.radius.countyName}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="sr-only">Details</dt>
              <dd className="text-amber-900/85 dark:text-amber-200/85">{state.radius.rationale}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void continueAfterRadius()}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-amber-800 px-4 text-sm font-medium text-white transition hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Continue to scans →
          </button>
        </section>
      )}

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
                : id === "radius"
                  ? state.radius
                  : id === "scans"
                  ? state.scans
                  : id === "retrieve-scans"
                    ? state.retrieveScans
                    : id === "analyze-gbp"
                      ? state.analyzeGbp
                      : id === "analyze-scan"
                        ? state.analyzeScan
                        : id === "website"
                          ? state.website
                          : id === "analyze-website"
                            ? state.analyzeWebsite
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
                      <pre className="max-h-[min(70vh,48rem)] overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-100/80 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={download}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Download {state.render.fileName}
          </button>
          {state.render.downloadUrl ? (
            <a
              href={state.render.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-zinc-800"
            >
              Open report link
            </a>
          ) : null}
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
