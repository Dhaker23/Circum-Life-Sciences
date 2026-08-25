// Circum API response envelope (RFC 7807-ish). PRD §11: thin handlers delegate to services.
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "./errors";

export type ApiSuccess<T> = { data: T; meta?: { page: number; pageSize: number; total: number } };
export type ApiError = { error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, meta?: ApiSuccess<T>["meta"]): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) });
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(err: unknown): NextResponse<ApiError> {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request", details: err.flatten() } },
      { status: 400 },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.statusCode },
    );
  }
  // Never leak internal details.
  console.error("Unhandled error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}

// Helper to parse+validate with zod, throwing ValidationError on failure.
export function parseOrThrow<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ValidationError("Invalid request", e.flatten() as unknown as Record<string, unknown>);
    }
    throw e;
  }
}
