import { NextResponse } from "next/server";

export function jsonResponse<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "cache-control": "s-maxage=60, stale-while-revalidate=300",
      ...(init?.headers ?? {})
    }
  });
}
