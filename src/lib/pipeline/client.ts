import { mergeStepData } from "./merge";
import type {
  PipelineInput,
  PipelineState,
  PipelineStepId,
  PipelineStepResponse,
} from "./types";
import { PIPELINE_STEPS } from "./types";

export type PipelineProgress = {
  step: string;
  state: PipelineState;
};

/** Parsed JSON from `/api/pipeline/:step`, or a client parse failure */
export type StepResponseBody =
  | PipelineStepResponse
  | { parseError: true; message: string };

export type StepResponseInfo = {
  step: PipelineStepId;
  httpStatus: number;
  body: StepResponseBody;
};

export type RunChunkedPipelineCallbacks = {
  onProgress?: (p: PipelineProgress) => void;
  /** Fires for every HTTP response (success or failure body, or parse error) before throwing on failure */
  onStepResponse?: (info: StepResponseInfo) => void;
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
 * Runs selected serverless steps in order. The client POSTs accumulated
 * `state` after each merge (chunked pipeline).
 */
export async function runPipelineSteps(
  initialState: PipelineState,
  steps: readonly PipelineStepId[],
  callbacks?: RunChunkedPipelineCallbacks,
): Promise<PipelineState> {
  const { onProgress, onStepResponse } = callbacks ?? {};
  let state = initialState;

  for (const step of steps) {
    const res = await fetch(`/api/pipeline/${step}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state } satisfies { state: PipelineState }),
    });

    const httpStatus = res.status;

    let body: StepResponseBody;
    try {
      body = (await res.json()) as PipelineStepResponse;
    } catch {
      body = {
        parseError: true,
        message: `Invalid JSON from /api/pipeline/${step} (${httpStatus})`,
      };
      onStepResponse?.({ step, httpStatus, body });
      throw new PipelineError(
        `Invalid JSON from /api/pipeline/${step} (${httpStatus})`,
        step,
      );
    }

    onStepResponse?.({ step, httpStatus, body });

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

/** Full pipeline order from {@link PIPELINE_STEPS}. */
export async function runChunkedPipeline(
  input: PipelineInput,
  callbacks?: RunChunkedPipelineCallbacks,
): Promise<PipelineState> {
  return runPipelineSteps({ input }, PIPELINE_STEPS, callbacks);
}
