import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  return {
    statusCode: 202,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "placeholder",
      message:
        "Future scheduled ingestion function. Implement adapter refresh, raw snapshot storage, normalization, and dashboard snapshot writes here.",
    }),
  };
};
