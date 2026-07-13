import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = readFileSync("components/dashboard/markets/markets-view.tsx", "utf8");
function parse(value:string){ const match=/^\s*([\d,]+)\s*\/\s*([\d,]+)\s*$/.exec(value); if(!match)return null; const [advancers,decliners]=[match[1],match[2]]; if(![advancers,decliners].every((part)=>/^\d{1,3}(,\d{3})*$|^\d+$/.test(part))) return null; return {advancers,decliners}; }
test("advancers decliners parser handles normal, zero, large, unavailable, malformed",()=>{ assert.deepEqual(parse("312 / 188"),{advancers:"312",decliners:"188"}); assert.deepEqual(parse("0 / 188"),{advancers:"0",decliners:"188"}); assert.deepEqual(parse("312 / 0"),{advancers:"312",decliners:"0"}); assert.deepEqual(parse("1,312 / 2,188"),{advancers:"1,312",decliners:"2,188"}); assert.equal(parse("—"),null); assert.equal(parse("312 / nope"),null); });
test("advancers decliners renderer includes accessibility and classes",()=>{ assert.match(source,/aria-label=\{`\$\{advancers\} advancers, \$\{decliners\} decliners`\}/); assert.match(source,/aria-hidden="true" className="text-positive">▲/); assert.match(source,/aria-hidden="true" className="text-negative">▼/); assert.match(source,/return <MetricRow metric=\{metric\} density="roomy" \/>/); });
