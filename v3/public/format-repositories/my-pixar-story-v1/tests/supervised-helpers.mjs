import assert from 'node:assert/strict';
import {Project,criteria,digest} from '../runtime/contracts.mjs';
import {initialProject,current,characterRecipeSha256,characterPromptRecipeSha256} from '../runtime/workflow.mjs';
import {image,author,registry,brief,prompt,ownerChecked} from './background-helpers.mjs';
import {shotPlan,composition,generated} from './shot-helpers.mjs';
import {videoPlan} from './studio-helpers.mjs';
import {inputs,script,file,send,authored,reviewed,approved,produce,intakeFixture,answersLocked} from './helpers.mjs';

// Invented people and protocol fixtures only. These are not human media labels.
export function confirmed(p,extra={}){
 const a=current(p),perception=p.step==='film'?'direct-audiovisual':p.step==='video'?'direct-video':['candidates','sheet','backgroundCandidates','backgroundAngle','keyframe'].includes(p.step)?'direct-image':'direct-audio';
 return approved(p,{humanReview:{decision:'approved',perception,checks:criteria[p.step].map(criterion=>({criterion,status:'pass',location:'ISOLATED fixture',evidence:'ISOLATED human-event simulation; no real quality claim.'}))},...extra});
}
export function advisory(p){
 const measurements={transcripts:p.step==='audition'?[script.beats[0].narration]:script.beats.map(b=>b.narration),speechToTextMethod:'ISOLATED STT',referenceSha256:file().sha256,speakingRateWpm:Array(p.step==='audition'?1:4).fill(80),silenceSeconds:Array(p.step==='audition'?1:4).fill(0),measurementNotes:'Calibrated similarity unavailable; explicit human voice comparison required.'};
 return reviewed(p,'provisional',{measurements,checks:criteria[p.step].map(criterion=>({criterion,status:criterion==='voice-match'?'inconclusive':'pass',evidence:'ISOLATED protocol fixture',location:'whole fixture',repair:''}))});
}
export function supervisedAudio(){
 let p=approved(reviewed(authored(answersLocked(initialProject('invented-supervised',inputs)))));
 p=send(p,'artifact',{actor:'human',workerId:'human',content:{files:[file()],consent:true,language:'en'}});
 p=send(p,'set-budget',{actor:'human',budgetLimitUsd:100,message:'ISOLATED spending ceiling'});
 p=produce(p,{provider:'cartesia',voiceId:'private-clone-test',receiptId:'isolated'});
 assert.equal(p.step,'audition');
 p=confirmed(advisory(produce(p,{files:[file(1)],voiceId:'private-clone-test',transcript:script.beats[0].narration})));
 return advisory(produce(p,{files:[1,2,3,4].map(n=>file(n)),voiceId:'private-clone-test',transcripts:script.beats.map(b=>b.narration),model:'isolated'}));
}
export function supervisedCharacters(){
 let p=confirmed(supervisedAudio());
 p=approved(reviewed(author(p,{characters:[{id:'alex',name:'Alex',ageVariant:'adult',important:true,references:[image(1)],notes:'Invented persona protocol fixture'}]},'cast-owner')));
 const c=current(p,'roster').content.characters[0];
 p=approved(reviewed(author(p,{prompt:'character',characterDigest:digest(c),referenceHashes:c.references.map(f=>f.sha256),recipeSha256:characterPromptRecipeSha256},'cast-owner')));
 p=confirmed(reviewed(produce(p,{files:[1,2,3].map(image),prompt:'character'})),{selection:0});
 p=approved(reviewed(author(p,{prompt:'sheet',recipeSha256:characterRecipeSha256,referenceSha256:image(1).sha256,turnaround:['front','three-quarter','profile','back'],expressions:Array(8).fill('expression')},'sheet-writer')));
 return confirmed(reviewed(produce(p,{files:[image(4)],prompt:'sheet'})));
}
export function supervisedBackgrounds(){
 let p=supervisedCharacters();p=approved(reviewed(author(p,{...registry,...shotPlan},'shot-planner')));
 p=approved(reviewed(author(p,registry)));
 while(p.step!=='shots'){
  if(['backgroundBrief','backgroundAngleBrief'].includes(p.step))p=approved(reviewed(author(p,brief(p))));
  else if(['backgroundPrompt','backgroundAnglePrompt'].includes(p.step))p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));
  else p=confirmed(reviewed(produce(p,{files:p.step==='backgroundCandidates'?[5,6,7].map(image):[image(8)],prompt:current(p,p.step==='backgroundCandidates'?`backgroundPrompt:${p.locationId}`:`backgroundAnglePrompt:${p.locationId}:${p.angleId}`).content.prompt})),p.step==='backgroundCandidates'?{selection:0}:{});
 }
 return p;
}

export function supervisedVideoReady(){
 let p=approved(reviewed(author(supervisedBackgrounds(),shotPlan,'shot-planner')));
 while(p.step!=='videoPlan')p=confirmed(reviewed(generated(approved(reviewed(author(p,composition(p),'composition-writer'))))));
 return approved(reviewed(author(p,videoPlan(p),'motion-director')));
}
