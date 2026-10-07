import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest} from '../runtime/contracts.mjs';
import {initialProject,openWorkflow,taskFor,current} from '../runtime/workflow.mjs';
import {prepareCrewTask,crewRoles} from '../runtime/crew.mjs';
import {scriptQuoteChecks,artifactEvidence} from '../runtime/evaluators.mjs';
import {validateDataset,taskForCase,runEvaluation} from '../evaluation/harness.mjs';
import {inputs,script,send,reviewed,approved} from './helpers.mjs';
const source=structuredClone(inputs);
source.answers.scene1Childhood.memory='Mom said, "You can try again." I did not know why I wanted to be a scientist. She got excited and seemed proud.';
const draft=()=>{const s=structuredClone(script);s.beats[0].narration='Mom said, “You can try again.”';s.beats[0].directQuotes=[{text:'You can try again.',sourceAnswer:'scene1Childhood',sourceField:'memory'}];return s;};
const corpus=JSON.parse(await readFile(new URL('../evaluation/text-personas.json',import.meta.url),'utf8'));

test('direct quotation gate binds exact words and cited source before review; paraphrases remain allowed without claiming factual approval',async()=>{
 const p=initialProject('ISOLATED-quotes',source,{workflowRevision:2}),before=digest(p);
 const authored=s=>send(p,'artifact',{workerId:'ISOLATED-Leo',content:s});
 const good=authored(draft());assert.equal(good.gate,'review');assert.equal(current(good).content.beats[0].directQuotes[0].text,'You can try again.');assert.equal(digest(p),before);
 for(const mutate of [s=>{s.beats[0].narration='Mom said, “You will try again.”';s.beats[0].directQuotes[0].text='You will try again.';},s=>{delete s.beats[0].directQuotes;},s=>{s.beats[0].directQuotes[0].sourceField='absent';},s=>{s.beats[0].sourceAnswers=['scene2TeenFreedom'];},s=>{s.beats[0].narration='Mom said, “You can try again.';},s=>{s.beats[0].directQuotes[0].text='You can try again. ';}]){
  const broken=draft();mutate(broken);assert.throws(()=>authored(broken),/QUOTATION_BINDING_REQUIRED/);assert.equal(digest(p),before);
 }
 const paraphrase=structuredClone(script);paraphrase.beats[0].narration='Mom encouraged me to try again.';assert.equal(authored(paraphrase).gate,'review');
 const partial=draft(),partialSource=structuredClone(source);partialSource.answers.scene1Childhood.memory='I was unhappy.';partial.beats[0].narration='I said, "happy"';partial.beats[0].directQuotes[0].text='happy';assert.equal(scriptQuoteChecks(partial,partialSource).status,'fail');
 const multiline=draft(),multilineSource=structuredClone(source),words='Try $5 [again].\nTake your time.';multilineSource.answers.scene1Childhood.memory=`Mom said, "${words}"`;multiline.beats[0].narration=`Mom said, “${words}”`;multiline.beats[0].directQuotes[0].text=words;assert.equal(scriptQuoteChecks(multiline,multilineSource).status,'pass');
 assert.equal(send(initialProject('ISOLATED-multiline',multilineSource,{workflowRevision:2}),'artifact',{workerId:'ISOLATED-Leo',content:multiline}).gate,'review');
 const evidence=await artifactEvidence(good);assert.equal(evidence.checks.find(c=>c.criterion==='quotations').status,'pass');assert.equal(evidence.checks.find(c=>c.criterion==='facts').status,'inconclusive');assert.equal(evidence.productionApproval,false);
});

test('quotation sources use human-confirmed answers while old policy snapshots and approved locks are not silently migrated',async()=>{
 const p=initialProject('ISOLATED-confirmed-source',source,{workflowRevision:3});let q=send(p,'artifact',{workerId:'ISOLATED-intake',content:{inputs:source,sourceInputDigest:digest(source),commonSenseChecks:[]}});
 const a=current(q);q=send(q,'changes',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED human clarification: Mom said Keep going.'});
 const clarified=structuredClone(source);clarified.answers.scene1Childhood.memory='Mom clarified: "Keep going."';
 q=approved(reviewed(send(q,'artifact',{workerId:'ISOLATED-intake',content:{inputs:clarified,sourceInputDigest:digest(source),commonSenseChecks:[]}})));assert.deepEqual(q.inputs,source);
 const s=draft();s.beats[0].narration='Mom said, "Keep going."';s.beats[0].directQuotes[0].text='Keep going.';assert.equal(send(q,'artifact',{workerId:'ISOLATED-Leo',content:s}).gate,'review');assert.equal(scriptQuoteChecks(s,source).status,'fail');
 // Build a valid old snapshot, rather than modifying a saved production project.
 const {loadStudio}=await import('../runtime/instructions.mjs');const snapshot=loadStudio();delete snapshot.config.writingPolicy;snapshot.sha256=digest({config:snapshot.config,documents:snapshot.documents});
 const historical=initialProject('ISOLATED-old-policy',source,{workflowRevision:2,studio:snapshot});const changed=draft();changed.beats[0].narration='Mom said, "Different words."';changed.beats[0].directQuotes=undefined;assert.equal(send(historical,'artifact',{workerId:'ISOLATED-Leo',content:changed}).gate,'review');
 const dir=await mkdtemp(join(tmpdir(),'memoir-writing-policy-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{await w.init('project',source,{workflowRevision:2,studio:snapshot});w.close();w=openWorkflow(join(dir,'state.sqlite'));const saved=await w.status('project');assert.equal(saved.project.studio.config.writingPolicy,undefined);assert.equal(saved.project.studio.sha256,snapshot.sha256);assert.equal(saved.project.jobs.length,0);}finally{w.close();await rm(dir,{recursive:true});}
});

test('writer and independent reviewer load hard factual/quotation rules and optional creative guidance through canonical task packets',async()=>{
 let p=initialProject('ISOLATED-policy-packets',source,{workflowRevision:2});const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`ISOLATED-${role}`,name,role,modelVersion:'ISOLATED',capabilityVersion:'ISOLATED',execution:'host'}))};p=send(p,'configure-crew',{actor:'human',message:'ISOLATED crew',crew});
 const author=await prepareCrewTask(p,taskFor(p));assert.equal(author.studioConfig.writingPolicy,'grounded-v1');assert.match(author.skill.content,/do not invent autobiographical events/);assert.match(author.skill.content,/Quoting is optional/);assert.match(author.skill.content,/sourceField/);assert.match(author.skill.content,/guidance, not mandatory ingredients/);assert.match(author.skill.content,/essential gap/);
 p=send(p,'artifact',{workerId:author.crewWorker.workerId,content:draft()});const reviewer=await prepareCrewTask(p,taskFor(p));assert.match(reviewer.reviewerRubric,/Reject material invented autobiographical facts/);assert.match(reviewer.reviewerRubric,/exact name matching alone/);assert.match(reviewer.reviewerRubric,/optional creative guidance, not rejection criteria/);assert.match(reviewer.reviewerRubric,/Do not fail a usable story/);assert.match(reviewer.reviewerRubric,/single-quote workarounds/);assert.equal(reviewer.evaluatorEvidence.productionApproval,false);assert.equal(p.gate,'review');assert.equal(p.jobs.length,0);
});

test('persona semantic evaluations hide proposed labels, bind the actual rubric and stay unscored/inconclusive without genuine review and human labels',async()=>{
 validateDataset(corpus);assert.ok(corpus.cases.some(c=>c.label.status==='pass'));assert.ok(corpus.cases.some(c=>c.label.status==='fail'));assert.ok(corpus.cases.every(c=>c.label.authority==='agent-provisional'&&!c.label.confirmed));
 assert.ok(corpus.cases.every(c=>/^text-\d+$/.test(c.id)));
 for(const authority of ['objective','direct-frame-inspection','capability-audit']){const falselyScored=structuredClone(corpus);falselyScored.cases[0].label.authority=authority;falselyScored.cases[0].label.confirmed=true;assert.throws(()=>validateDataset(falselyScored),/SEMANTIC_LABEL_AUTHORITY/);}
 const leaked=structuredClone(corpus.cases[0]);leaked.input.label={status:'fail'};assert.throws(()=>taskForCase(leaked));
 const nested=structuredClone(corpus.cases.find(c=>c.kind==='answers-completeness'));nested.input.draft.label={status:'pass'};assert.throws(()=>taskForCase(nested));
 for(const c of corpus.cases){const t=taskForCase(c);assert.equal(t.label,undefined);assert.equal(t.split,undefined);assert.equal(t.input.label,undefined);assert.match(t.input.reviewerRubric,/Grounded storytelling policy/);assert.equal(t.inputDigest,digest({kind:t.kind,input:t.input}));}
 const report=await runEvaluation(corpus,{split:'all'});assert.equal(report.apiCalls,0);assert.equal(report.productionApproval,false);assert.equal(report.qualification.semanticScriptJudge,false);assert.deepEqual(report.metrics,{});assert.ok(report.results.every(r=>!r.scored&&r.prediction.check.status==='inconclusive'));
 const structuralOnly=report.results.map(r=>structuredClone(r.prediction));structuralOnly[0].check.status='pass';await assert.rejects(runEvaluation(corpus,{split:'all',predictions:structuralOnly}),/direct-text review/);
 const t=taskForCase(corpus.cases[0]),predictions=report.results.map(r=>r.prediction);predictions[0]={...predictions[0],inputDigest:digest({kind:t.kind,input:corpus.cases[0].input})};await assert.rejects(runEvaluation(corpus,{split:'all',predictions}),/STALE/);
});
