type Result = { url:string; run:number; ok:boolean; status:number; ttfbMs:number; totalMs:number; bytes:number; contentType:string|null; cacheControl:string|null; cdnCacheControl:string|null; netlifyCacheControl:string|null; cacheStatus:string|null; serverTiming:string|null };
const DEFAULT_PATHS = ["/overview/today","/markets","/news-calendar","/flow","/ownership","/status"];
function env(name:string){ return process.env[name]?.trim(); }
function baseUrl(){ const value=env("PERF_BASE_URL")||env("URL")||env("DEPLOY_PRIME_URL"); if(!value) throw new Error("Set PERF_BASE_URL to the production or deploy-preview origin."); return value.replace(/\/$/,""); }
function paths(){ return (env("PERF_PATHS")?.split(",").map(s=>s.trim()).filter(Boolean) ?? DEFAULT_PATHS); }
async function measure(url:string, run:number): Promise<Result> { const start=performance.now(); const res=await fetch(url,{headers:{"user-agent":"AlphaDigestPerformanceAudit/1.0"}}); const first=performance.now(); const buf=Buffer.from(await res.arrayBuffer()); const end=performance.now(); return {url,run,ok:res.ok,status:res.status,ttfbMs:+(first-start).toFixed(1),totalMs:+(end-start).toFixed(1),bytes:buf.length,contentType:res.headers.get("content-type"),cacheControl:res.headers.get("cache-control"),cdnCacheControl:res.headers.get("cdn-cache-control"),netlifyCacheControl:res.headers.get("netlify-cdn-cache-control"),cacheStatus:res.headers.get("x-nf-cache")??res.headers.get("x-cache"),serverTiming:res.headers.get("server-timing")}; }
async function main(){ const origin=baseUrl(); const runs=Number(env("PERF_RUNS")||3); const out:Result[]=[]; for(const path of paths()){ for(let i=1;i<=runs;i++){ out.push(await measure(`${origin}${path.startsWith("/")?path:`/${path}`}`,i)); await new Promise(r=>setTimeout(r,250)); } } console.log(JSON.stringify({generatedAt:new Date().toISOString(), origin, runs, results:out},null,2)); }
main().catch(e=>{ console.error(e.message); process.exit(1); });

export {};
