import type { ZodType } from "zod";
import { NextResponse } from "next/server";

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export function parseBody<T>(schema: ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    ),
  };
}
