import { jsonResponse } from "@/lib/api/responses";
import { mockMeta } from "@/lib/data/fixtures/dashboard";
import { genericPayloadSchema } from "@/lib/data/schemas/dashboard";

export function GET(){return jsonResponse(genericPayloadSchema,{meta:{...mockMeta,source:"FRED / CBOE / AAII fixture layer"},message:"Macro data is mocked until FRED, CBOE, and AAII adapters are enabled.",rows:[{metric:"Macro Backdrop",value:"Neutral"},{metric:"Rates",value:"Restrictive"}]});}
