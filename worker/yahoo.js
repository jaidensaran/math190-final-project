// Yahoo's public chart interface is unofficial and may reject server requests.
// No login cookies, crumb extraction, proxy rotation, or automatic retries.
export class DataError extends Error {
  constructor(message, status=502, code='upstream_error', retryAfter=0) {
    super(message); Object.assign(this,{status,code,retryAfter});
  }
}
export function exchangeDate(seconds, timezone='America/New_York') {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(seconds*1000));
  const get=type=>parts.find(p=>p.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function parseYahoo(payload,symbol,now=Date.now()) {
  const chart=payload?.chart;
  if(chart?.error)throw new DataError('Yahoo could not return history for this company.','Not Found'===chart.error.code?404:502,'yahoo_data_error');
  const result=chart?.result?.[0];
  if(!result||!Array.isArray(result.timestamp))throw new DataError('Yahoo returned no usable price history.',502,'invalid_yahoo_data');
  if(result.meta?.symbol?.toUpperCase()!==symbol)throw new DataError('Yahoo returned a different symbol. No prices were imported.',502,'symbol_mismatch');
  const meta=result.meta||{},currency=meta.currency;
  if(currency!=='USD')throw new DataError('This stock model currently expects USD-denominated data.',502,'currency_mismatch');
  const timezone=meta.exchangeTimezoneName||'America/New_York',today=exchangeDate(now/1000,timezone);
  const close=result.indicators?.quote?.[0]?.close;
  const adjusted=result.indicators?.adjclose?.[0]?.adjclose;
  const useAdjusted=Array.isArray(adjusted)&&adjusted.some(p=>Number.isFinite(p)&&p>0);
  if(!Array.isArray(close))throw new DataError('Yahoo returned no closing-price series.',502,'invalid_yahoo_data');
  const end=meta.currentTradingPeriod?.regular?.end;
  const rows=[];let incomplete=0;
  for(let i=0;i<result.timestamp.length;i++) {
    const stamp=result.timestamp[i];if(!Number.isFinite(stamp)||stamp*1000>now)continue;
    const date=exchangeDate(stamp,timezone);
    if(date>today)continue;
    // A daily bar can contain a live/incomplete session; do not fit it as a daily close.
    if(date===today&&(!Number.isFinite(end)||now<end*1000)){incomplete++;continue;}
    const rawClose=close[i],value=useAdjusted?adjusted[i]:rawClose;
    if(!Number.isFinite(rawClose)||rawClose<=0||!Number.isFinite(value)||value<=0)continue;
    rows.push({date,close:value,rawClose});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(rows.map(r=>r.date)).size!==rows.length)throw new DataError('Yahoo returned duplicate session dates.',502,'invalid_yahoo_data');
  if(rows.length<41)throw new DataError('Yahoo returned fewer than 41 completed daily observations. Try another date or import a CSV.',422,'insufficient_history');
  return {provider:'yahoo',providerName:'Yahoo Finance',symbol,currency,timezone,rows,asOf:rows.at(-1).date,
    fetchedAt:new Date(now).toISOString(),frequency:'daily',adjusted:useAdjusted,incompleteBarsExcluded:incomplete,
    adjustment:useAdjusted?'Yahoo adjusted closes (vendor split/dividend adjustments; values may be revised)':'Yahoo closes; dividend-adjusted series unavailable',
    source:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,
    notice:'Unofficial public interface; availability is not guaranteed. Daily history is not a streaming quote feed. Adjusted returns are vendor-adjusted, not pure ex-dividend price returns.'};
}
export async function fetchYahoo(symbol,origin=null,fetcher=fetch,now=Date.now()) {
  const url=new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval','1d');url.searchParams.set('events','div,splits');url.searchParams.set('includeAdjustedClose','true');
  if(origin){const day=Date.parse(origin+'T00:00:00Z');url.searchParams.set('period1',String(Math.floor((day-400*86400000)/1000)));url.searchParams.set('period2',String(Math.floor(Math.min(now,day+180*86400000)/1000)));}
  else url.searchParams.set('range','2y');
  let response;
  try{response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'QuantLab/0.3 (personal research)'},signal:AbortSignal.timeout(15000),redirect:'manual'});}
  catch(error){console.error('Yahoo chart request failed',String(error?.name||'Error'),String(error?.message||'Unknown network error').slice(0,250));throw new DataError('Yahoo could not be reached. Your existing data is unchanged.',502,'yahoo_unreachable');}
  if(response.status>=300&&response.status<400)throw new DataError('Yahoo redirected the public data request. No sign-in or consent flow was bypassed; use CSV or another provider.',503,'yahoo_redirect',900);
  if(response.status===429){const raw=response.headers.get('Retry-After');const value=raw&&/^\d+$/.test(raw)?Number(raw):raw?Math.ceil((Date.parse(raw)-now)/1000):900;const seconds=Math.min(86400,Math.max(60,Number.isFinite(value)?value:900));throw new DataError('Yahoo is rate-limiting this server. Try after the cooldown or use CSV/another provider. No prices were replaced.',429,'yahoo_rate_limited',seconds);}
  if(response.status===401||response.status===403)throw new DataError('Yahoo denied server access to its public endpoint. No account credentials are requested; use CSV or another provider.',503,'yahoo_access_denied',900);
  if(!response.ok)throw new DataError('Yahoo price history is temporarily unavailable.',502,'yahoo_unavailable');
  let payload;try{payload=await response.json()}catch{throw new DataError('Yahoo returned an unexpected response. Your existing data is unchanged.',502,'invalid_yahoo_data');}
  return parseYahoo(payload,symbol,now);
}
