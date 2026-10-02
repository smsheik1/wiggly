import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {current} from '../runtime/workflow.mjs';
import {criteria} from '../runtime/contracts.mjs';
import {supervisedBackgrounds} from './supervised-helpers.mjs';
import {approved,reviewed,send} from './helpers.mjs';
import {author} from './background-helpers.mjs';
import {shotPlan,composition,generated} from './shot-helpers.mjs';
const corpus=JSON.parse(await readFile(new URL('../evaluation/invented-regression.json',import.meta.url),'utf8'));
const keyframeReady=()=>approved(reviewed(author(supervisedBackgrounds(),shotPlan,'shot-planner')));
for(const c of corpus.cases)test(`${c.id}: ${c.persona}; ${c.expected} (protocol only)`,()=>{
 let p=keyframeReady();
 if(c.kind==='binding'){
  const prompt=composition(p);
  if(c.mutation==='order')prompt.references.reverse();
  else if(c.mutation==='hash')prompt.references[1].sha256='f'.repeat(64);
  else prompt.references[1].characterId=c.mutation==='age'?'alex-child':'rowan';
  assert.throws(()=>author(p,prompt,'composition-writer'),/exact approved/);return;
 }
 p=generated(approved(reviewed(author(p,composition(p),'composition-writer'))));const a=current(p);
 const q=send(p,'review',{workerId:'reviewer',artifactId:a.id,artifactDigest:a.digest,review:{decision:c.status==='fail'?'rejected':c.status==='inconclusive'?'inconclusive':'approved',perception:c.perception,checks:criteria.keyframe.map(criterion=>({criterion,status:criterion===c.criterion?c.status:'pass',evidence:criterion===c.criterion?c.evidence:'ISOLATED scripted passing observation',location:'ISOLATED region',repair:criterion===c.criterion?c.repair??'':''}))}});
 if(c.expected==='human'){assert.equal(q.gate,'human');assert.equal(q.step,'keyframe');}
 else if(c.expected==='repair'){assert.equal(q.step,'keyframePrompt');assert.equal(q.gate,'author');assert.equal(current(q,`keyframe:${p.shotId}`),undefined);assert.ok(q.feedback.some(f=>f.message.includes(c.repair)));}
 else assert.equal(q.gate,'escalate');
 assert.equal(q.artifacts.some(a=>a.approvedBy&&a.kind==='keyframe'),false);
});
