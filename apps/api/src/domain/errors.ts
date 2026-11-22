/** An expected failure a client can act on. Anything else is a 500. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERROR_STATUS = {
  bad_request: 400,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden: 403,
  not_found: 404,
  slot_taken: 409,
  already_confirmed: 409,
  invalid_state: 409,
  invalid_input: 422,
  too_many_requests: 429,
  not_implemented: 501,
} as const;

export type AppErrorCode = keyof typeof ERROR_STATUS;
