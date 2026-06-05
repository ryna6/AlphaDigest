import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonResponse<T>(schema: z.ZodType<T>, payload: T) {
  const parsed = schema.parse(payload);
  return NextResponse.json(parsed, {
    headers: { "Cache-Control": "no-store" },
  });
}
