import type { FastifyReply } from 'fastify';

/**
 * Consistent API error model (directive #37).
 * Never leak Prisma/database internals to clients.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  unauthenticated: (msg = 'Authentication required') => new ApiError(401, 'UNAUTHENTICATED', msg),
  forbidden: (msg = 'You are not authorized to perform this action') => new ApiError(403, 'FORBIDDEN', msg),
  notFound: (code: string, msg: string) => new ApiError(404, code, msg),
  validation: (msg = 'Invalid request', details?: unknown) => new ApiError(400, 'VALIDATION_ERROR', msg, details),
  conflict: (code: string, msg: string) => new ApiError(409, code, msg),
  internal: (msg = 'Internal server error') => new ApiError(500, 'INTERNAL_ERROR', msg),
};

/** Serialize any error into the standard envelope and send it. */
export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof ApiError) {
    return reply.status(err.status).send({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  // Unknown error — log server-side, return a generic message.
  reply.log.error(err);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
