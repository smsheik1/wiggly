import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { tool, createMiddleware } from 'langchain';
import { z } from 'zod';
import { StudioProduction, type WorkerLease } from '../../lib/studio-production.js';
import { askActiveAgent } from '../../lib/agent-bridge.js';
import { workspaceAgent, hash } from './harness.js';
import { productionMiddleware } from './production-tools.js';
import { photoDelivery } from './reference-intake.js';
import { referencedMedia } from './rehearsal-worker.js';

const modelName = 'gemini-3.8-flash';
const Report = z.object({verdict:z.enum(['PASS','CHANGES_REQUESTED','INCONCLUSIVE']),findings:z.string().min(20).max(20000),direction_compatible:z.boolean(),defects:z.array(z.object({criterion:z.string().min(1),region:z.string().min(1),evidence:z.string().min(1)}).strict()),coverage:z.array(z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),perceptible:z.boolean(),complete:z.boolean(),findings:z.string().min(20),heard_words:z.string().optional()}).strict())}).strict();
export type GeminiReviewerOptions = {key:string;references:any;traceClient?:any;inspectionFiles?:any[];modelOverride?:BaseChatModel};

/** One Gemini-powered Deep Agent owns inspection, reasoning and its finishing tool. */
export async function runGeminiMediaReviewer(store:StudioProduction,ctx:WorkerLease,options:GeminiReviewerOptions) {
 const packet=store.reviewPacket(ctx.ticketId),candidateBytes=readFileSync(packet.candidate_path);
 if(!['audio','image','text'].includes(packet.modality))throw new Error('DIRECT_MEDIA_REVIEW_REQUIRED');
 if(hash(candidateBytes)!==packet.content_hash)throw new Error('REVIEW_CANDIDATE_CHANGED');
 const candidate=JSON.parse(candidateBytes.toString()),files=[...new Map([...referencedMedia(candidate),...(options.inspectionFiles??[])].map(f=>[f.sha256,f])).values()];
 if(!files.length)throw new Error('ACTUAL_MEDIA_REQUIRED');
 const bytes=files.map(f=>readFileSync(f.path)),mediaKind=packet.modality==='audio'?'audio':'image';
 files.forEach((f,i)=>{if(hash(bytes[i])!==f.sha256||bytes[i].length!==f.bytes||(mediaKind==='audio'?(!f.durationSeconds||f.width):(!f.width||f.durationSeconds)))throw new Error('MEDIA_BYTES_REQUIRED');});
 const approvedInputs=Object.fromEntries(Object.entries(packet.exact_inputs as Record<string,string>).map(([name,id])=>[name,JSON.parse(readFileSync(store.acceptedVersion(packet.project_id,id).path,'utf8'))]));
 const assignment=store.memoirAssignment(packet.ticket_id),context={packet,approved_inputs:approvedInputs,assignment_outcome:assignment?JSON.parse(assignment.packet).outcome:null,references:options.references,candidate};
 const root=dirname(store.draftDirectory(ctx)),runId=randomUUID();let inspected=false,deliveryCompleted=false,fatal:unknown,report:z.infer<typeof Report>|undefined;const receipts:string[]=[];let lastOperationId:string|undefined;
 mkdirSync(join(root,'references'),{recursive:true});mkdirSync(join(root,'skills/memoir-reviewer'),{recursive:true});
 const packetPath=join(root,'references/review-packet-'+hash(Buffer.from(JSON.stringify(context)))+'.json');
 writeFileSync(packetPath,JSON.stringify(context),{mode:0o400,flag:'wx'});
 const rubric=readFileSync(join(import.meta.dirname,'../../public/format-repositories/my-pixar-story-v1/evaluation/rubrics',mediaKind==='audio'?'audio.md':'visual.md'),'utf8');
 writeFileSync(join(root,'skills/memoir-reviewer/SKILL.md'),`---\nname: memoir-reviewer\ndescription: Independently inspect exact memoir media and submit your verdict.\n---\nInspect the actual supplied media before submit_review. Compare against the approved inputs, requested outcome and director direction. Coverage must include every supplied hash. Unavailable perception is INCONCLUSIVE. Never generate media or approve production.
${rubric}`,{mode:0o600});
 const inspect=tool((_args,runtime)=>{
  if(hash(readFileSync(packet.candidate_path))!==packet.content_hash||files.some((f,i)=>hash(readFileSync(f.path))!==f.sha256))throw new Error('REVIEW_CANDIDATE_CHANGED');
  inspected=true;deliveryCompleted=false;
  return photoDelivery([{type:'text',text:JSON.stringify(context)},...files.flatMap((f,i)=>[{type:'text',text:JSON.stringify({sha256:f.sha256,durationSeconds:f.durationSeconds,roles:[...(candidate.files??[]).map((v:any,j:number)=>v.sha256===f.sha256?'presentation beat '+(j+1):null),...(candidate.sourceFiles??[]).map((v:any,j:number)=>v.sha256===f.sha256?'source beat '+(j+1):null)].filter(Boolean)})},mediaKind==='image'?{type:'image_url',image_url:{url:`data:${f.path.endsWith('.png')?'image/png':f.path.endsWith('.webp')?'image/webp':'image/jpeg'};base64,${bytes[i].toString('base64')}`}}:{type:'audio',source_type:'base64',mime_type:'audio/wav',data:bytes[i].toString('base64')}] )],runtime);
 },{name:'inspect_candidate',description:'Receive the actual pinned images or audio plus the authoritative review packet. No delegated perception or verdict.',schema:z.object({}).strict()});
 const submit=tool((value)=>{
  if(!inspected||!deliveryCompleted)throw new Error('ACTUAL_MEDIA_INSPECTION_REQUIRED');
  if(JSON.stringify(value.coverage.map(c=>c.sha256).sort())!==JSON.stringify(files.map(f=>f.sha256).sort())||value.coverage.some(c=>!c.perceptible||!c.complete))throw new Error('GEMINI_REVIEW_COVERAGE_INCONCLUSIVE');
  if(mediaKind==='audio'&&value.coverage.some(c=>typeof c.heard_words!=='string'))throw new Error('AUDIO_TRANSCRIPT_REQUIRED');
  const details={runId,model:modelName,modality:packet.modality,coverage:packet.coverage};
  for(const [i,f] of files.entries()){const evidence=store.mediaSupplied(ctx,bytes[i],{...details,modality:mediaKind});store.inspectionCompleted(ctx,evidence,value.coverage.find(c=>c.sha256===f.sha256)!.findings);}
  const evidence=store.mediaSupplied(ctx,candidateBytes,details);store.inspectionCompleted(ctx,evidence,value.findings);
  const result=store.submitReview(ctx,{verdict:value.verdict,findings:value.findings,direction_compatible:value.direction_compatible,defects:value.defects,evidence_references:[evidence]});report=value;return result;
 },{name:'submit_review',description:'Submit your own independent verdict after inspecting all actual media; ends this agent run. Does not confer director approval.',schema:Report,returnDirect:true});
 const budget=createMiddleware({name:'GeminiReviewerOperations',wrapModelCall:async(request,handler)=>{
  if(fatal)throw fatal;const operationId=randomUUID(),receiptPath=join(root,operationId+'-gemini-agent.json');let response:any;
  try{await store.executeOperation(ctx,{operationId,provider:'gemini',requestHash:hash(Buffer.from(JSON.stringify(request.messages))),estimateMicros:120000},async()=>{
   response=await handler(request);writeFileSync(receiptPath,JSON.stringify(response),{mode:0o600,flag:'wx'});receipts.push(receiptPath);
   const usage=response.usage_metadata;if(!usage||!Number.isSafeInteger(usage.input_tokens)||!Number.isSafeInteger(usage.output_tokens))throw new Error('GEMINI_USAGE_REQUIRED');
   // Total-minus-input includes reasoning tokens omitted from candidatesTokenCount by the SDK.
   const output=Math.max(usage.output_tokens,(usage.total_tokens??0)-usage.input_tokens);
   return{completed:{result:{artifactReferences:[],receiptReference:receiptPath},actualAllowanceMicros:Math.ceil(usage.input_tokens*.75+output*3.75),providerUsage:{reported:usage,basis:'Reported tokens at dated rate; not invoice charges'}}};
  },e=>`${String(e).replaceAll(options.key,'[REDACTED]')}\nSTOP: https://aistudio.google.com/usage and https://aistudio.google.com/api-keys; GEMINI_API_KEY in /Users/shaz/Projects/wiggly/secrets.env. No automatic retry or model substitution.`);
  lastOperationId=operationId;
  if(inspected&&bytes.every(b=>JSON.stringify(request.messages).includes(b.toString('base64'))))deliveryCompleted=true;
  return response;
  }catch(e){fatal=e;throw e;}
 }});
 const audioDirection=mediaKind==='audio'?'Listen directly and transcribe each supplied clip in heard_words. Evaluate pacing, complete words, seams, clipping and delivery. Presentation beats target 15 seconds with 200 ms tolerance; archived source clips may differ. The director already approved this voice.':'Inspect likeness, approved age direction, anatomy, wardrobe, style and composition directly.';
 const system=`You are the independent memoir reviewer powered by Gemini. Load /skills/memoir-reviewer/SKILL.md and use /references/${packetPath.split('/').at(-1)} as authoritative data. Call inspect_candidate to see/hear the actual media, then reason about its exact criteria and call submit_review yourself with coverage for every supplied hash. Do not delegate perception or judgment. ${audioDirection} PASS requires no defects and complete direct perception. You cannot generate media or approve production.`;
 const model=options.modelOverride??new ChatGoogleGenerativeAI({model:modelName,apiKey:options.key,maxOutputTokens:8192,maxRetries:0,streaming:false,disableStreaming:true});
 const agent=workspaceAgent(model,root,'gemini-review-'+ctx.ticketId+'-'+ctx.token,ctx.workerId,[inspect,submit],system,[productionMiddleware(store,ctx),budget]);
 const callbacks=options.traceClient?[new LangChainTracer({client:options.traceClient,projectName:'wiggly-studio-phase1'})]:[];
 await askActiveAgent(system,{operatingAgent:prompt=>agent.invoke({messages:[{role:'user',content:prompt}]},{callbacks,signal:AbortSignal.timeout(180000),metadata:{ticket:ctx.ticketId,model:modelName,reviewer_architecture:'Deep Agents / LangGraph',media_hashes:files.map(f=>f.sha256)}})});
 if(!report)throw new Error('GEMINI_REVIEW_NOT_SUBMITTED');return{report,receiptPath:receipts.at(-1)!,operationId:lastOperationId!,runId,receiptPaths:receipts};
}
export async function runGeminiAudioReviewer(store:StudioProduction,ctx:WorkerLease,options:GeminiReviewerOptions) {
 if(store.reviewPacket(ctx.ticketId).modality!=='audio')throw new Error('AUDIO_REVIEW_REQUIRED');return runGeminiMediaReviewer(store,ctx,options);
}
