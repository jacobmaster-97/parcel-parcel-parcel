// Build-level bandwidth contracts, run after npm run build:vercel.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=n=>fs.readFile(path.join(root,n)),json=async n=>JSON.parse(await read(n)),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=await json('dist/version.json'),html=await read('dist/index.html'),config=await json('vercel.json');
assert.equal(manifest.html_sha256,sha(html));assert.equal(manifest.save_schema,11);
for(const[name,file]of Object.entries(manifest.immutableAssets)){const data=await read('dist/'+file);assert.match(file,new RegExp('\\.'+sha(data).slice(0,16)+'\\.'));assert.deepEqual(data,await read(name));}
const staticRule=config.headers.find(r=>r.source==='/static/(.*)');assert.equal(staticRule.headers[0].value,'public, max-age=31536000, immutable');
for(const name of ['/','/index.html','/version.json','/manifest.webmanifest'])assert.match(config.headers.find(r=>r.source===name).headers[0].value,/max-age=0, must-revalidate/);
assert.ok(config.headers.filter(r=>r.headers.some(h=>h.value.includes('immutable'))).every(r=>r.source==='/static/(.*)'));
const text=html.toString();assert.ok(text.includes(manifest.immutableAssets['social-preview-v2.png']));assert.ok(text.includes(manifest.immutableAssets['icon-180.png']));
const webmanifest=await json('dist/manifest.webmanifest');for(const i of webmanifest.icons){assert.ok(i.src.startsWith('static/'));await read('dist/'+i.src);}
const assetMeta=await json('assets/metadata/bandwidth-v01911.json');for(const a of assetMeta.assets){assert.equal(a.rgbaDifferences,0);assert.equal(sha(await read(a.file)),a.sha256);assert.ok(!text.includes((await read(a.original)).toString('base64')),'raw source PNG must not be embedded');assert.ok(text.includes((await read(a.file)).toString('base64')),'packed PNG must be embedded');}
const music=await json('assets/metadata/background_music.json');for(const t of music.tracks){assert.equal(sha(await read(t.file)),t.mp3Sha256);assert.equal(t.channels,2);assert.equal(t.sampleRate,44100);assert.equal(t.targetBitrateKbps,t.id==='business'?96:64);assert.ok(t.mp3Bytes<t.originalMp3Bytes);}
assert.equal(sha(await read(assetMeta.shareImage.file)),assetMeta.shareImage.sha256,'sharing image must remain unchanged');
console.log('Bandwidth contracts PASS: hashed immutable assets, mutable HTML, manifest SHA, exact PNGs, no raw embedding, audio metadata, unchanged sharing artwork.');
