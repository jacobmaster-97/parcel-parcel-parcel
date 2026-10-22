import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const host=value('--host','127.0.0.1'),port=Number(value('--port','4173'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=pathname==='/'?'index.html':pathname.slice(1);
  if(!['index.html','app.css','favicon.svg'].includes(relative)&&!relative.startsWith('src/')&&
   !/^assets\/(characters|environment|ui)\//.test(relative)){res.writeHead(404).end();return;}
  const target=path.resolve(root,relative);
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const content=await fs.readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store'}).end(content);
 }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,host,()=>console.log(`Parcel Point local prototype: http://${host}:${port}`));
