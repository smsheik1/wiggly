import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';

export function assertDebugReady(p){
 if(p.debug?.enabled&&p.debug.paused)throw new Error('DEBUG_PAUSED: inspect the saved output, then request debug-next with the human instruction. This does not approve work or authorize spend.');
}

// An operator view of existing evidence, never a second project state store.
export async function debugSnapshot(status,runDir){
 const {project:p,pending}=status;
 if(!p.debug?.enabled)throw new Error('DEBUG_DISABLED: explicitly enable operator debug mode first.');
 const directory=join(runDir,'host-dispatch');
 let names=[];
 try{names=(await readdir(directory)).filter(n=>n.endsWith('.json')).sort();}catch(e){if(e.code!=='ENOENT')throw e;}
 const path=join(directory,pending.taskId+'.json');let currentDispatch=null;
 try{currentDispatch={path,...JSON.parse(await readFile(path,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}
 return {operatorOnly:true,approvesNothing:true,providerCalls:0,checkpointId:status.checkpointId,
  sequence:p.sequence,debug:p.debug,studioSha256:p.studio?.sha256,task:pending,
  latestArtifact:p.artifacts.at(-1)??null,latestJob:p.jobs.at(-1)??null,
  artifacts:p.artifacts.map(a=>({id:a.id,key:a.key,digest:a.digest,valid:a.valid,approved:!!a.approvedBy,dependencies:a.dependencies})),
  recentHistory:p.history.slice(-10),currentDispatch,dispatchReceipts:names.map(n=>join(directory,n)),
  instruction:'Show the current step and actual output in chat. Compare our verdict with the assigned reviewer. Continue is separate from approval and spend authorization. Fix reusable code/skills with a regression check; never edit checkpoint rows, receipts or approved asset bytes.'};
}
