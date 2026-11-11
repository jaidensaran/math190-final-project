// Only the most recently selected request may change the visible company.
// Reuse in-flight requests and short-lived successes to avoid unnecessary calls.
export function createPriceLoader(fetcher=fetch,{ttl=15*60*1000,now=Date.now}={}) {
  const cache=new Map();let active=null,revision=0;
  return {
    cancel(){revision++;active?.controller.abort();active=null;},
    load(key,url,{force=false}={}) {
      if(active?.key===key)return active.promise;
      const token=++revision;active?.controller.abort();active=null;
      const hit=cache.get(key);
      if(!force&&hit&&hit.expires>now())return Promise.resolve({data:hit.data,stale:false,cached:true});
      const controller=new AbortController();
      const promise=(async()=>{
        try {
          const response=await fetcher(url,{signal:controller.signal});const data=await response.json();
          if(token!==revision)return {stale:true};
          if(!response.ok){const error=new Error(data.error||'Price feed unavailable.');error.retryAfter=data.retryAfter||0;throw error;}
          if(!Array.isArray(data.rows)||data.rows.length<41)throw new Error('Provider returned insufficient history.');
          cache.set(key,{data,expires:now()+ttl});if(cache.size>60)cache.delete(cache.keys().next().value);
          return {data,stale:false,cached:false};
        }catch(error){if(token!==revision||error.name==='AbortError')return {stale:true};throw error;}
        finally{if(token===revision)active=null;}
      })();
      active={key,promise,controller};return promise;
    }
  };
}
