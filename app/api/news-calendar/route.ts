import { jsonResponse } from "@/lib/api/responses";
import { mockMeta, topNews } from "@/lib/data/fixtures/dashboard";
import { genericPayloadSchema } from "@/lib/data/schemas/dashboard";

export function GET(){return jsonResponse(genericPayloadSchema,{meta:{...mockMeta,source:"Unusual Whales major-only news feed mock"},message:"Mock data enabled. Add source adapters and keys in Netlify for live data.",rows:topNews});}
