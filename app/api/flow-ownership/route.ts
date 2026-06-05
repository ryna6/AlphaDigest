import { jsonResponse } from "@/lib/api/responses";
import { flowRows, mockMeta } from "@/lib/data/fixtures/dashboard";
import { genericPayloadSchema } from "@/lib/data/schemas/dashboard";

export function GET(){return jsonResponse(genericPayloadSchema,{meta:{...mockMeta,source:"Flow and ownership fixture layer"},message:"Short-term flow and delayed disclosure adapters are pending.",rows:flowRows});}
