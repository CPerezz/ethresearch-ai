import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logRequest } from "./logger";

type HandlerFn = (
  request: Request,
  context?: any
) => Promise<NextResponse>;

export function apiHandler(fn: HandlerFn): HandlerFn {
  return async (request: Request, context?: any) => {
    const start = Date.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    try {
      const response = await fn(request, context);
      logRequest(method, path, response.status, Date.now() - start);
      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (error instanceof ZodError) {
        logRequest(method, path, 400, duration);
        return NextResponse.json(
          {
            error: "Validation failed",
            details: error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      logRequest(method, path, 500, duration, message);
      console.error("[API Error]", error);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
