export class AnthropicApiError extends Error {
  readonly httpStatus: number;
  readonly endpoint: string;
  /** Parsed API error body when JSON included `error` */
  readonly apiError?: { type?: string; message?: string };

  constructor(
    message: string,
    options: {
      httpStatus: number;
      endpoint: string;
      apiError?: { type?: string; message?: string };
    },
  ) {
    super(message);
    this.name = "AnthropicApiError";
    this.httpStatus = options.httpStatus;
    this.endpoint = options.endpoint;
    this.apiError = options.apiError;
  }
}
