import { mergeStepData } from "./merge";
import type { PipelineInput, PipelineState, PipelineStepResponse } from "./types";
import { PIPELINE_STEPS } from "./types";

export type PipelineProgress = {
  step: string;
  state: PipelineState;
};

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

/**
 * Runs each serverless chunk in order. The client holds full `PipelineState`
 * and POSTs it to every step (see SKILL / chunked pipeline).
 */
export async function runChunkedPipeline(
  input: PipelineInput,
  onProgress?: (p: PipelineProgress) => void,
): Promise<PipelineState> {
  let state: PipelineState = { input };

  for (const step of PIPELINE_STEPS) {
    const res = await fetch(`/api/pipeline/${step}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state } satisfies { state: PipelineState }),
    });

    let body: PipelineStepResponse;
    try {
      body = (await res.json()) as PipelineStepResponse;
    } catch {
      throw new PipelineError(
        `Invalid JSON from /api/pipeline/${step} (${res.status})`,
        step,
      );
    }

    if (!body.ok) {
      throw new PipelineError(body.error, body.step, body.code);
    }

    if (body.step !== step) {
      throw new PipelineError(
        `Step mismatch: expected ${step}, got ${body.step}`,
        step,
      );
    }

    state = mergeStepData(state, body.step, body.data);
    onProgress?.({ step, state });
  }

  return state;
}
