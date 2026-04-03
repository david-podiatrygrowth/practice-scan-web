import { NextResponse } from "next/server";
import type { PipelineStepFailure, PipelineStepId } from "./types";

export function fail(
  step: PipelineStepId,
  error: string,
  code?: string,
  status = 400,
) {
  const body: PipelineStepFailure = { ok: false, step, error, code };
  return NextResponse.json(body, { status });
}
