import {bundle} from '@remotion/bundler';
import {rm, mkdir, readFile, writeFile, readdir} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const kit=dirname(fileURLToPath(import.meta.url)),v3=resolve(kit,'../../..'),destination=join(kit,'build','remotion');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await bundle({entryPoint:join(v3,'remotion-entry/index.ts'),outDir:destination,publicDir:join(kit,'examples'),
  webpackOverride:config=>({...config,output:{...config.output,filename:chunk=>chunk.chunk.name==='main'?'bundle.js':'preview.js'},entry:{main:config.entry,preview:[join(kit,'node_modules/@remotion/bundler/react-shim.js'),join(v3,'remotion-entry/MemoirPreview.tsx')]},resolve:{...config.resolve,modules:[join(kit,'node_modules'),...(config.resolve?.modules??[])]}})});
const files=[];
async function inventory(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())await inventory(p);else if(entry.name!=='renderer-manifest.json')files.push({path:relative(destination,p),sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}
await inventory(destination);
await writeFile(join(destination,'renderer-manifest.json'),JSON.stringify({renderer:'remotion-entry/RemotionAdScene.tsx → AdRenderSurface → memoir-film',remotionVersion:'4.0.473',files},null,2));
console.log('Built official Wiggly renderer and shared memoir Player preview.');
