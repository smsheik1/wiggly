import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, renderOverlay, layout } from '../runtime/render.mjs';
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

test('Shorts output is true 1080x1920 vertical with caption space above the bottom controls',()=>{
 assert.equal(layout.width,1080);assert.equal(layout.height,1920);assert.equal(layout.width/layout.height,9/16);
 assert.ok(layout.captionTop+2*layout.captionLineHeight<=layout.height-300);
 assert.ok((layout.width-layout.textWidth)/2>=90);
});
function pixels(buffer,predicate){const found=[];for(let y=0;y<layout.height;y++)for(let x=0;x<layout.width;x++){const i=(y*layout.width+x)*4;if(predicate(buffer.subarray(i,i+4),x,y))found.push({x,y});}return found;}
test('readable title uses smooth full-size type instead of tiny bitmap glyphs',async()=>{
 const input=structuredClone(base);input.header.title='BATMAN VS SONIC';
 const overlay=await renderOverlay(input);
 assert.equal(overlay.length,1080*1920*4);
 const ink=pixels(overlay,([r,g,b],x,y)=>y<150&&r>150&&g<110&&b<110);
 assert.ok(Math.max(...ink.map(p=>p.y))-Math.min(...ink.map(p=>p.y))>=55,'Title must remain legible at native Shorts resolution');
 assert.ok(pixels(overlay,([r,g,b],x,y)=>y<150&&r>206&&r<255&&g>34&&g<255&&b>42&&b<255).length>50,'Title edges must be antialiased');
 assert.equal(overlay[(500*layout.width+540)*4+3],0,'Gameplay remains visible through the overlay');
});
test('widest allowed title, question and caption keep safe side margins',async()=>{
 const input=structuredClone(base);input.header.title='W'.repeat(25);input.header.question='W'.repeat(36);
 const turn=input.turns[0];const overlay=await renderOverlay(input,turn,{text:'W'.repeat(19)});
 const edgeInk=pixels(overlay,([r,g,b,a],x,y)=>(x<80||x>=layout.width-80)&&((y<layout.headerHeight&&(r<245||g<245||b<245))||(y>=layout.headerHeight&&a>0)));
 assert.equal(edgeInk.length,0,'Typography must not clip or bleed into the side margin');
});
