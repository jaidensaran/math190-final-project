import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const server=createServer(async(req,res)=>{const response=await worker.fetch(new Request('http://127.0.0.1:8765'+req.url,{method:req.method}),{}, {waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))});
server.listen(8765,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8765'));
