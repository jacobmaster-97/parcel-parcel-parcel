import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'deliverables');
fs.mkdirSync(destination,{recursive:true});
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const assetFiles=['characters','environment','ui'].flatMap(folder=>files(path.join(root,'assets',folder))).filter(p=>p.endsWith('.png')&&!p.endsWith('/staff_gate.png'));
const embedded=Object.fromEntries(assetFiles.map(file=>[path.relative(root,file).split(path.sep).join('/'),`data:image/png;base64,${fs.readFileSync(file).toString('base64')}`]));
const css=fs.readFileSync(path.join(root,'app.css'),'utf8');
const code=['layout.js','courier-art.js','finance.js','day-events.js','upgrades.js','game.js','save.js','storage.js','app.js'].map(name=>fs.readFileSync(path.join(root,'src',name),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="app.css">',()=>`<style>${css}</style>`);
html=html.replace(/src="(assets\/[^"<>]+\.png)"/g,(match,name)=>`src="${embedded[name]}"`);
html=html.replace('<script type="module" src="src/app.js"></script>',
 ()=>`<script>window.__PACKAGED_ASSETS__=${JSON.stringify(embedded)};</script>\n<script type="module">\n${code}\n</script>`);
const single=path.join(destination,'parcel-point-prototype-v0.11.0.html');fs.writeFileSync(single,html);
const zip=path.join(destination,'parcel-point-prototype-v0.11.0.zip');
const entries=['index.html','app.css','package.json','src/day-events.js','src/upgrades.js','src/finance.js','src/save.js','src/storage.js','src/game.js','src/app.js','src/layout.js','src/courier-art.js','tools/serve-game.mjs',
 'tools/package-prototype.mjs','tests/operations-smoke.mjs','design/NPC_DIALOGUE_PROPOSAL.md','tests/art-smoke.mjs','assets/metadata/approved-art-v0.9.json','tests/shop-revision-smoke.mjs','tests/shop-revision.test.mjs','tests/day-events-smoke.mjs','tests/day-events.test.mjs','tests/game.test.mjs','tests/upgrade-smoke.mjs','tests/upgrades.test.mjs','tests/finance.test.mjs','tests/save.test.mjs','tests/storage-smoke.mjs','tests/browser-smoke.mjs','tests/offline-smoke.mjs','tests/ui-smoke.mjs',
 'PROTOTYPE.md','QA_REPORT.md','design/UPGRADE_PRIORITIES.md','design/store-upgrades-v2/IMPLEMENTED.md','design/random-events-v1/FRAMEWORK.md','design/random-events-v1/IMPLEMENTED.md',...assetFiles.map(f=>path.relative(root,f))];
// Standard ZIP assembly with built-in Node facilities: no runtime dependencies
// or subprocess required. Visible artwork is reused unchanged.
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
const records=[...entries.map(name=>[name,fs.readFileSync(path.join(root,name))]),['PLAY-OFFLINE.html',Buffer.from(html)]];
const chunks=[],central=[];let offset=0;
for(const[name,data]of records){
 const filename=Buffer.from(name),compressed=deflateRawSync(data),crc=crc32(data);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
 local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x5d56,12);
 local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
 const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);
 directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(8,10);directory.writeUInt16LE(0x5d56,14);
 directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);
 directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
 chunks.push(local,filename,compressed);central.push(directory,filename);offset+=local.length+filename.length+compressed.length;
}
const centralBuffer=Buffer.concat(central),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(records.length,8);end.writeUInt16LE(records.length,10);
end.writeUInt32LE(centralBuffer.length,12);end.writeUInt32LE(offset,16);
fs.writeFileSync(zip,Buffer.concat([...chunks,centralBuffer,end]));
console.log(`Offline HTML: ${single} (${fs.statSync(single).size.toLocaleString()} bytes)`);
console.log(`Source + offline ZIP: ${zip} (${fs.statSync(zip).size.toLocaleString()} bytes)`);
