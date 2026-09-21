import { NextResponse } from 'next/server';

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: ApiFieldError[];
  retryable?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiErrorBody;
}

export function apiSuccess<T>(data?: T, message?: string, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  fieldErrors?: ApiFieldError[],
  retryable = false
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        fieldErrors,
        retryable,
      },
    },
    { status }
  );
}

export const ApiErrors = {
  unauthorized: (msg = 'Authentication required') =>
    apiError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Insufficient permissions for this action') =>
    apiError('FORBIDDEN', msg, 403),
  notFound: (msg = 'Resource not found') =>
    apiError('NOT_FOUND', msg, 404),
  badRequest: (msg = 'Invalid request', fieldErrors?: ApiFieldError[]) =>
    apiError('BAD_REQUEST', msg, 400, fieldErrors),
  conflict: (msg = 'Resource conflict or state mismatch', retryable = false) =>
    apiError('CONFLICT', msg, 409, undefined, retryable),
  internal: (msg = 'Internal server error', retryable = true) =>
    apiError('INTERNAL_ERROR', msg, 500, undefined, retryable),
};
