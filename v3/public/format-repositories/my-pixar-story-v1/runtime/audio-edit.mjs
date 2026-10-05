import {z} from 'zod';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,readdir,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {digest,File,text} from './contracts.mjs';
import {verifyFiles,importMedia,narrationWindow} from './media.mjs';
const exec=promisify(execFile);
export const AUDIO_EDIT_PROFILE='ffmpeg-narration-ranges-v1';
export const AudioEditPlan=z.object({kind:z.enum(['pause-shortening','pronunciation-repair']),keepRanges:z.array(z.object({startSeconds:z.number().finite().nonnegative(),endSeconds:z.number().finite().positive()}).strict()).min(1).max(32),reason:text}).strict();
export const AudioEditReceipt=z.object({beat:z.number().int().min(1).max(4),parentArtifactId:text,parentArtifactDigest:text,sourceFile:File,editedFile:File,outputFile:File,tailSilenceSeconds:z.number().nonnegative(),plan:AudioEditPlan,editDigest:text,receiptPath:text}).strict();
export function validateAudioEdit(file,raw){
 const plan=AudioEditPlan.parse(raw);let end=0,total=0;
 for(const r of plan.keepRanges){if(r.startSeconds<end||r.endSeconds<=r.startSeconds||r.endSeconds>file.durationSeconds)throw new Error('AUDIO_EDIT_RANGE_INVALID: ordered, non-overlapping ranges inside the measured source required.');end=r.endSeconds;total+=r.endSeconds-r.startSeconds;}
 if(!file.durationSeconds||file.width||file.durationSeconds>60||total>15+1e-9||total<1)throw new Error('AUDIO_EDIT_DURATION_INVALID: preserve 1–15 seconds of a measured audio-only source; never change speed.');
 return {plan,retainedSeconds:total};
}
export async function inspectAudio(file){
 await verifyFiles(file);
 if(!file.durationSeconds||file.width||file.durationSeconds>60)throw new Error('AUDIO_EDIT_SOURCE_INVALID');
 const {stderr}=await exec('ffmpeg',['-hide_banner','-i',file.path,'-af','silencedetect=noise=-40dB:d=0.05','-f','null','-'],{maxBuffer:2**20});
 const starts=[...stderr.matchAll(/silence_start: ([0-9.]+)/g)].map(m=>Number(m[1]));
 const ends=[...stderr.matchAll(/silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)/g)].map(m=>Number(m[1]));
 return {sha256:file.sha256,durationSeconds:file.durationSeconds,pauses:starts.map((startSeconds,i)=>({startSeconds,endSeconds:ends[i]??file.durationSeconds})),method:'FFmpeg -40dB silence detection, minimum 50ms; low-energy intervals are candidates, not proof a cut is inaudible.'};
}
export function removedRanges(file,plan){let end=0;const cuts=[];for(const r of plan.keepRanges){if(r.startSeconds>end)cuts.push({startSeconds:end,endSeconds:r.startSeconds});end=r.endSeconds;}if(end<file.durationSeconds)cuts.push({startSeconds:end,endSeconds:file.durationSeconds});return cuts;}
export function createAudioEditTools({runDir}){
 const rendering=new Map();
 return {inspectAudio:async({file})=>inspectAudio(file),renderAudioEdit:async({file,task,worker,edit})=>{
  if(task.step!=='narration'||task.gate!=='author'||worker.role!=='film-editor'||task.artifact?.review?.decision!=='rejected'||task.artifact.approvedBy)throw new Error('AUDIO_EDIT_SCOPE_DENIED: only the assigned editor may repair current unapproved rejected narration.');
  const beat=task.artifact.content.files.findIndex(f=>f.sha256===file.sha256)+1;
  if(!beat)throw new Error('AUDIO_EDIT_SOURCE_INVALID: use a current narration stem, not a voice reference.');
  await verifyFiles(file);const {plan,retainedSeconds}=validateAudioEdit(file,edit);
  if(!removedRanges(file,plan).length)throw new Error('AUDIO_EDIT_NO_CHANGE');
  const inspection=await inspectAudio(file);
  if(plan.kind==='pause-shortening'&&removedRanges(file,plan).some(c=>!inspection.pauses.some(p=>c.startSeconds>=p.startSeconds-1e-5&&c.endSeconds<=p.endSeconds+1e-5)))throw new Error('AUDIO_EDIT_SPEECH_CUT_DENIED: pause-only edits must stay within detected low-energy intervals.');
  if(plan.kind==='pronunciation-repair'&&!task.artifact.review.checks.some(c=>['transcript','delivery'].includes(c.criterion)&&c.status==='fail'))throw new Error('AUDIO_EDIT_PRONUNCIATION_EVIDENCE_REQUIRED');
  const descriptor={profile:AUDIO_EDIT_PROFILE,taskId:task.taskId,workerId:worker.workerId,artifactId:task.artifact.id,artifactDigest:task.artifact.digest,sourceSha256:file.sha256,plan};
  const editDigest=digest(descriptor),base=join(runDir,'audio-edits',task.taskId),dir=join(base,editDigest);await mkdir(base,{recursive:true,mode:0o700});await chmod(base,0o700);
  try{const cached=JSON.parse(await readFile(join(dir,'result.json'),'utf8'));if(cached.editDigest!==editDigest||cached.resultDigest!==digest(cached.result))throw new Error('AUDIO_EDIT_RECEIPT_CHANGED');await verifyFiles(cached.result);return AudioEditReceipt.parse(cached.result);}catch(e){if(e.code!=='ENOENT')throw e;}
  const attempts=(await readdir(base,{withFileTypes:true})).filter(d=>d.isDirectory()).length;
  const active=rendering.get(base)??0;
  if(attempts+active>=3)throw new Error('AUDIO_EDIT_ATTEMPT_LIMIT: three drafts per task; report the remaining problem.');
  rendering.set(base,active+1);
  try{
  await mkdir(dir,{mode:0o700});await writeFile(join(dir,'plan.json'),JSON.stringify(descriptor)+'\n',{flag:'wx',mode:0o600});
  // The agent supplies ranges only. No shell, arbitrary filters, speed or pitch controls.
  // Tiny fades lie inside retained samples; concat introduces no time compression.
  const filters=plan.keepRanges.map((r,i)=>`[0:a]atrim=start=${r.startSeconds}:end=${r.endSeconds},asetpts=PTS-STARTPTS,afade=t=in:d=0.003,afade=t=out:st=${Math.max(0,r.endSeconds-r.startSeconds-.003)}:d=0.003[a${i}]`);
  filters.push(`${plan.keepRanges.map((_,i)=>`[a${i}]`).join('')}concat=n=${plan.keepRanges.length}:v=0:a=1[out]`);
  const rendered=join(dir,'edited.wav');await exec('ffmpeg',['-v','error','-y','-i',file.path,'-filter_complex',filters.join(';'),'-map','[out]','-c:a','pcm_s16le',rendered]);await chmod(rendered,0o600);
  const editedFile=await importMedia(rendered,runDir);
  if(Math.abs(editedFile.durationSeconds-retainedSeconds)>.001||editedFile.durationSeconds>15)throw new Error('AUDIO_EDIT_RENDER_MISMATCH');
  const window=await narrationWindow(editedFile,runDir,join(dir,'window.wav'));await chmod(join(dir,'window.wav'),0o600).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const result=AudioEditReceipt.parse({beat,parentArtifactId:task.artifact.id,parentArtifactDigest:task.artifact.digest,sourceFile:file,editedFile,outputFile:window.file,tailSilenceSeconds:window.tailSilenceSeconds,plan,editDigest,receiptPath:dir});
  await writeFile(join(dir,'result.json.tmp'),JSON.stringify({editDigest,resultDigest:digest(result),result})+'\n',{mode:0o600});await rename(join(dir,'result.json.tmp'),join(dir,'result.json'));return result;
  }finally{rendering.set(base,(rendering.get(base)??1)-1);}
 }};
}
