type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export async function handler(): Promise<HandlerResponse> {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "placeholder",
      message: "Future scheduled ingestion function. Implement adapter -> Supabase snapshot refresh here."
    })
  };
}
