export class FirecrawlApiError extends Error {
  readonly httpStatus: number;
  readonly endpoint: string;
  readonly code?: string;

  constructor(
    message: string,
    options: { httpStatus: number; endpoint: string; code?: string },
  ) {
    super(message);
    this.name = "FirecrawlApiError";
    this.httpStatus = options.httpStatus;
    this.endpoint = options.endpoint;
    this.code = options.code;
  }
}
