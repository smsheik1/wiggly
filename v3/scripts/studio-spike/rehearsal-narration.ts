import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StudioProduction } from '../../lib/studio-production.js';
import { assertPreserved, rehearsalProject } from './rehearsal.js';
import { hash } from './harness.js';
import { loadMemoirFormat, existingVoiceChoice } from './memoir-format.js';

/** Producer-authored batch scope. No credentials, provider calls, claims, or approvals. */
export async function prepareNarrationBatch(root: string, kit: string) {
  const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
  assertPreserved(manifest.source,manifest.saved_production_hashes);
  const format=await loadMemoirFormat(kit), providers=await import(pathToFileURL(join(kit,'runtime/providers.mjs')).href);
  const inputs=format.contracts.Inputs.parse(JSON.parse(readFileSync(join(root,'references/inputs.json'),'utf8')));
  const script=format.contracts.Content.script.parse(JSON.parse(readFileSync(join(root,'drafts/script.json'),'utf8')));
  if(hash(Buffer.from(JSON.stringify(script)))!==manifest.authored_script_hash)throw new Error('REHEARSAL_SCRIPT_CHANGED');
  const preferred=JSON.parse(readFileSync(join(root,'references/preferred-script.json'),'utf8'));
  if(JSON.stringify(script.beats.map((b:any)=>b.narration))!==JSON.stringify(preferred.beats.map((b:any)=>b.narration)))throw new Error('PREFERRED_NARRATION_CHANGED');
  const answers=format.contracts.Content.answers.parse({inputs,sourceInputDigest:format.contracts.digest(inputs),commonSenseChecks:[]});
  const approval=JSON.parse(readFileSync(join(root,'references/answers-approval.json'),'utf8'));
  if(approval.actor!=='human'||approval.action!=='approve'||approval.artifactDigest!==format.contracts.digest(answers))throw new Error('SOURCE_ANSWERS_APPROVAL_MISMATCH');
  const old=manifest.voice_selection;
  const lookup=format.contracts.VoiceLookup.parse({voiceId:old.voiceId,name:old.name,language:old.language,isOwner:old.isOwner,status:old.status,access:old.access,apiVersion:old.apiVersion,checkedAt:old.checkedAt,endpoint:old.endpoint,httpStatus:200});
  const consent=JSON.parse(readFileSync(join(root,'references/voice-consent-note.json'),'utf8'));
  if(consent.actor!=='human'||!consent.content.voiceConsent)throw new Error('VOICE_CONSENT_REQUIRED');
  const clone=format.contracts.Content.clone.parse({voiceId:lookup.voiceId,provider:'cartesia',receiptId:`voice-lookup:${format.contracts.digest(lookup)}`,origin:{kind:'existing',lookup,selectionMessage:'Reuse the existing Cartesia voice selection, as explicitly directed in the live rehearsal plan.',consentMessage:consent.message}});
  const artifacts=[{key:'script',kind:'script',valid:true,content:script},{key:'clone',kind:'clone',valid:true,content:clone}];
  const projection={id:rehearsalProject,inputs,step:'audition',workflowRevision:4,studio:format.snapshot,artifacts,voiceChoice:existingVoiceChoice(clone.origin)};
  const jobs=['audition','narration'].map(operation=>{
    const estimate=providers.generationEstimate(projection,operation);
    const plan=format.contracts.Plans.parse({provider:'cartesia',operation,estimatedCostUsd:estimate.estimatedCostUsd,parameters:{model:format.config.generation.voice.model,cartesiaVersion:format.config.generation.voice.apiVersion}});
    return {plan,request:providers.requestDescriptor(projection,plan)};
  });
  const quote={id:'story-narration-v1',authorized:false,allowance_micros:2000000,project_id:rehearsalProject,
    script_hash:manifest.authored_script_hash,voice_id:lookup.voiceId,writer:'Preserved preferred Kimi K3 draft; active Codex metadata repair only',
    execution_model:'deepseek/deepseek-v4.1-flash',route:'decart/fp4',perception_model:'gemini-3.8-flash',
    initial_cartesia_characters:jobs.reduce((sum,j)=>sum+j.request.costEstimate.characters,0),initial_cartesia_allowance_usd:jobs.reduce((sum,j)=>sum+j.plan.estimatedCostUsd,0),
    ticket_caps_micros:{answers_review:100000,script_review:100000,clone_review:100000,audition_author:200000,audition_review:200000,narration_author:700000,narration_review:600000},
    limits:{model_turns:12,generation_attempts_per_asset:3,automatic_external_retries:0},
    deliverables:['Independent source/script/voice-provenance reviews','One existing-voice audition','Four intact, measured narration beats','Separate author and reviewer audio inspections','Actual audio presented inline for director approval'],
    repair_scope:'Observed narration delivery/seams/timing only, within the same cap and three generation attempts. No script wording changes without director direction. No automatic retry on external error.',
    pricing:{cartesia:'https://cartesia.ai/pricing',gemini:'https://ai.google.dev/gemini-api/docs/pricing',openrouter:'https://openrouter.ai/deepseek/deepseek-v4.1-flash'},
    cost_note:'Allowance is a ceiling, not a cash charge. Cartesia consumes included subscription credits first when available; balance and invoices are unverified. Separate usage and verified charges in the scorecard.',
    excluded:['Voice cloning','New image/video generation','Music/effects/lip-sync','Unrelated saved production','Any previous test allowance'],
    gates:['Refresh existing voice metadata before synthesis','Independent reviews must pass','Director recognizes and approves the audition before remaining narration','Inconclusive perception blocks the batch','Exact completed narration requires director approval']};
  const store=new StudioProduction(root);try {if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');}finally{store.close();}
  const dir=join(root,'story-narration');mkdirSync(dir,{recursive:true});
  for(const [name,value]of Object.entries({quote,answers,script,'existing-voice-provenance':clone,'generation-plans':jobs})){
    const file=join(dir,name+'.json'),serialized=JSON.stringify(value,null,2);
    if(existsSync(file)){if(readFileSync(file,'utf8')!==serialized)throw new Error('PREPARED_NARRATION_BATCH_CHANGED');}else writeFileSync(file,serialized,{mode:0o600,flag:'wx'});
  }
  assertPreserved(manifest.source,manifest.saved_production_hashes);
  return {quote,quote_sha256:hash(Buffer.from(JSON.stringify(quote))),contracts:'PASS',new_paid_calls:0,saved_files_unchanged:Object.keys(manifest.saved_production_hashes).length};
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
  if(process.argv.length!==4)throw new Error('Use rehearsal-narration.ts ROOT KIT (free preparation only)');
  console.log(JSON.stringify(await prepareNarrationBatch(resolve(process.argv[2]),resolve(process.argv[3])),null,2));
}
