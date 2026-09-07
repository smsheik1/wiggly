import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, renderOverlay } from '../runtime/render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=JSON.parse(await readFile(path.join(root,'inputs/same-universe.json'),'utf8'));
test('supplied media produces complete validated eight-second conversation',async()=>{const result=await validate(base,root);assert.equal(result.total,8);assert.equal(result.turns.length,4);});
for(const [name,mutate,pattern]of [
 ['no missing narration',input=>delete input.turns[0].audio,/Each turn requires/],
 ['no unapproved gameplay',input=>input.gameplay.authorized=false,/gameplay authorization/],
 ['no silent audio fallback',input=>input.turns[0].audio.file='assets/missing.wav',/ENOENT/],
 ['no external media path',input=>input.gameplay.file='../source.mp4',/portable and relative/],
 ['caption times stay in their turn',input=>input.turns[0].captions[0].end=3,/Caption timings/],
 ['no truncated caption transcript',input=>input.turns[0].captions[0].text='OTHER WORDS',/cover/],
 ['cast mode agrees with universes',input=>input.castMode='crossover',/castMode must agree/],
 ['audio timing must agree',input=>input.turns[0].durationSeconds=3,/Audio duration/]
])test(name,async()=>{const input=structuredClone(base);mutate(input);await assert.rejects(validate(input,root),pattern);});

function pixels(buffer,predicate){const found=[];for(let y=0;y<640;y++)for(let x=0;x<480;x++){const i=(y*480+x)*4;if(predicate(buffer.subarray(i,i+4),x,y))found.push({x,y});}return found;}
test('readable title uses smooth full-size type instead of tiny bitmap glyphs',async()=>{
 const input=structuredClone(base);input.header.title='BATMAN VS SONIC';
 const overlay=await renderOverlay(input);
 assert.equal(overlay.length,480*640*4);
 const ink=pixels(overlay,([r,g,b],x,y)=>y<65&&r>150&&g<110&&b<110);
 assert.ok(Math.max(...ink.map(p=>p.y))-Math.min(...ink.map(p=>p.y))>=25,'Title must be visibly larger than the previous 21-pixel bitmap text');
 assert.ok(pixels(overlay,([r,g,b],x,y)=>y<65&&r>206&&r<255&&g>34&&g<255&&b>42&&b<255).length>50,'Title edges must be antialiased');
 assert.equal(overlay[(200*480+240)*4+3],0,'Gameplay remains visible through the overlay');
});
test('widest allowed title, question and caption keep safe side margins',async()=>{
 const input=structuredClone(base);input.header.title='W'.repeat(25);input.header.question='W'.repeat(36);
 const turn=input.turns[0];const overlay=await renderOverlay(input,turn,{text:'W'.repeat(19)});
 const edgeInk=pixels(overlay,([r,g,b,a],x,y)=>(x<18||x>=462)&&((y<136&&(r<245||g<245||b<245))||(y>=136&&a>0)));
 assert.equal(edgeInk.length,0,'Typography must not clip or bleed into the side margin');
});
