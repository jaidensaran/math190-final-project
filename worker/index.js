// __ASSETS__ and __YAHOO_ADAPTER__ are replaced by the deterministic build.
const assets = __ASSETS__;
const supported = new Set(__SYMBOLS__);
// __YAHOO_ADAPTER__
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const memory=new Map();let yahooCooldown=null;
function errorResponse(error){const status=error.status||502;return json({error:error.message||'The data request failed. Existing data is unchanged.',code:error.code||'upstream_error',retryAfter:error.retryAfter||undefined},status,error.retryAfter?{'Retry-After':String(error.retryAfter)}:{});}
async function alpha(query,env){const url=new URL('https://www.alphavantage.co/query');for(const [k,v]of Object.entries(query))url.searchParams.set(k,v);url.searchParams.set('apikey',env.ALPHA_VANTAGE_API_KEY);let r;try{r=await fetch(url,{signal:AbortSignal.timeout(15000)})}catch{throw new DataError('Alpha Vantage could not be reached. Existing data is unchanged.')};if(!r.ok)throw new DataError('Alpha Vantage is temporarily unavailable.');const d=await r.json();if(d.Information||d.Note)throw new DataError('Alpha Vantage limit or entitlement reached. Try later or import CSV.',429,'alpha_limit',900);if(d['Error Message'])throw new DataError('Alpha Vantage could not supply this dataset.');return d;}
async function cached(request,ctx,key,fn){
  // Some Sites runtimes expose caches but deny access to caches.default.
  // Use bounded isolate memory when the optional platform cache is unavailable.
  let cache=null;try{cache=globalThis.caches?.default}catch{}
  const cacheKey=new Request(new URL('/__data_cache/v4/'+encodeURIComponent(key),request.url));
  if(cache){try{const hit=await cache.match(cacheKey);if(hit)return json(await hit.json(),200,{'Cache-Control':'private, max-age=60'})}catch{cache=null}}
  const hit=memory.get(key);if(hit&&hit.expires>Date.now())return json(hit.data);
  const data=await fn();memory.set(key,{data,expires:Date.now()+900000});if(memory.size>100)memory.delete(memory.keys().next().value);
  if(cache){try{ctx.waitUntil(cache.put(cacheKey,json(data,200,{'Cache-Control':'public, max-age=900'})).catch(()=>{}))}catch{}}
  return json(data);
}
function validOrigin(value){if(!value)return null;const t=Date.parse(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value||value<'1980-01-01'||t>Date.now())throw new DataError('Choose a valid historical origin between 1980 and today.',400,'invalid_origin');return value;}
export default {async fetch(request,env={},ctx={waitUntil:()=>{}}){try{
  const url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405,{Allow:'GET, HEAD'});
  if(url.pathname==='/api/config')return json({configured:true,provider:'Yahoo Finance',defaultProvider:'yahoo',frequency:'daily',cacheHours:.25,newsConfigured:Boolean(env.ALPHA_VANTAGE_API_KEY),providers:{yahoo:{available:true,requiresKey:false,unofficial:true},alpha:{available:Boolean(env.ALPHA_VANTAGE_API_KEY),requiresKey:true}}});
  if(['/api/prices','/api/news'].includes(url.pathname)){
    const symbol=url.searchParams.get('symbol');if(!supported.has(symbol))return json({error:'Choose a company from the supported universe.'},400);
    const provider=url.searchParams.get('provider')||'yahoo';if(!['yahoo','alpha'].includes(provider))return json({error:'Unknown price provider.'},400);
    const origin=validOrigin(url.searchParams.get('origin'));
    if(url.pathname==='/api/news'||provider==='alpha'){
      if(!env.ALPHA_VANTAGE_API_KEY)return json({error:'Alpha Vantage news/price access needs a server-side key. Yahoo daily prices do not require that key.'},503);
    }
    return await cached(request,ctx,[url.pathname,symbol,provider,origin||'recent',env.ALPHA_VANTAGE_ADJUSTED==='true'].join(':'),async()=>{
      if(url.pathname==='/api/news'){const d=await alpha({function:'NEWS_SENTIMENT',tickers:symbol,limit:'10',sort:'LATEST'},env);return{provider:'Alpha Vantage',fetchedAt:new Date().toISOString(),articles:(d.feed||[]).filter(a=>/^https:\/\//.test(a.url||'')).slice(0,10).map(a=>({title:String(a.title||'').slice(0,400),url:a.url,source:String(a.source||''),time:String(a.time_published||''),summary:String(a.summary||'').slice(0,600)}))}}
      if(provider==='yahoo'){
        if(yahooCooldown?.until>Date.now())throw new DataError(yahooCooldown.message,yahooCooldown.status,yahooCooldown.code,Math.ceil((yahooCooldown.until-Date.now())/1000));
        try{return await fetchYahoo(symbol,origin)}catch(e){if(e.retryAfter)yahooCooldown={...e,message:e.message,until:Date.now()+e.retryAfter*1000};throw e}
      }
      const adjusted=env.ALPHA_VANTAGE_ADJUSTED==='true';const d=await alpha({function:adjusted?'TIME_SERIES_DAILY_ADJUSTED':'TIME_SERIES_DAILY',symbol,outputsize:'compact'},env);const series=d['Time Series (Daily)'];if(!series)throw new DataError('No daily prices were returned. Check your provider plan or import CSV.');const today=new Date().toISOString().slice(0,10),rows=Object.entries(series).map(([date,v])=>({date,close:Number(v[adjusted?'5. adjusted close':'4. close'])})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<=today&&Number.isFinite(r.close)&&r.close>0).sort((a,b)=>a.date.localeCompare(b.date));if(rows.length<41)throw new DataError('Insufficient daily history was returned.');return{provider:'alpha',providerName:'Alpha Vantage',symbol,currency:'USD',rows,asOf:rows.at(-1).date,fetchedAt:new Date().toISOString(),adjustment:adjusted?'Provider-adjusted closes':'Raw closes; splits and dividends are not adjusted',source:'https://www.alphavantage.co/documentation/#daily'};
    });
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Unknown API route.'},404);
  const path=url.pathname==='/'?'/index.html':url.pathname,asset=assets[path];if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'"}});
}catch(error){return errorResponse(error instanceof DataError?error:new DataError('The data request failed. Existing data is unchanged.'))}}};
