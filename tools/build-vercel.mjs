// Generate a fresh static deployment from source; never serve a stale docs bundle.
import './package-prototype.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SAVE_SCHEMA} from '../src/save.js';
import {ACHIEVEMENTS} from '../src/achievements.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
let html=fs.readFileSync(path.join(root,'deliverables',`parcel-point-prototype-v${version}.html`));
const output=path.join(root,'dist');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
// Only Vercel owns /_vercel/insights; keep Pages and offline builds independent.
const analyticsEnabled=process.env.VERCEL==='1'&&process.env.VERCEL_ANALYTICS_DISABLED!=='1';
if(analyticsEnabled){
 const sdk=fs.readFileSync(fileURLToPath(import.meta.resolve('@vercel/analytics')),'utf8');
 fs.writeFileSync(path.join(output,'vercel-analytics.js'),sdk);
 const analytics=`<script type="module">
import {inject} from './vercel-analytics.js';
if(location.protocol==='https:')inject({mode:'production',beforeSend(event){
 const url=new URL(event.url);url.search='';url.hash='';return {...event,url:url.href};
}});
</script>`;
 html=Buffer.from(html.toString().replace('</body>',analytics+'\n</body>'));
}
fs.writeFileSync(path.join(output,'index.html'),html);
for(const name of ['manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'])fs.copyFileSync(path.join(root,name),path.join(output,name));
const preview=path.join(root,'docs','music-preview');
if(fs.existsSync(preview))fs.cpSync(preview,path.join(output,'music-preview'),{recursive:true});
const previous=path.join(root,'docs','version.json');
const manifest=fs.existsSync(previous)?JSON.parse(fs.readFileSync(previous,'utf8')):{};
Object.assign(manifest,{version,html_sha256:createHash('sha256').update(html).digest('hex'),save_schema:SAVE_SCHEMA,achievements:ACHIEVEMENTS.length,icons:ACHIEVEMENTS.length});
manifest.vercelAnalytics=analyticsEnabled;
manifest.features=[...new Set([...(manifest.features||[]),'prototype-label-hidden','vercel-static-build'])];
fs.writeFileSync(path.join(output,'version.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Vercel static output: dist/index.html (${html.length.toLocaleString()} bytes), version ${version}`);
