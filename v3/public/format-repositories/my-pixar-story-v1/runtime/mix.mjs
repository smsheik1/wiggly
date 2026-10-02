export function audioMixArgs(manifest,out){
 const {narration,music,effects,edit}=manifest,inputs=[...narration,music,...effects.map(e=>e.file)],filters=[];const n=0;
 narration.forEach((file,i)=>filters.push(`[${n+i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${edit.narrationGainDb}dB,adelay=${i*15000}|${i*15000},apad=whole_dur=60,atrim=duration=60[a${i}]`));
 filters.push('[a0][a1][a2][a3]amix=inputs=4:normalize=0:dropout_transition=0[vo]');
 filters.push(`[${n+4}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=60,asetpts=PTS-STARTPTS,volume=${edit.musicGainDb}dB,afade=t=in:d=${edit.musicFadeInSeconds},afade=t=out:st=${60-edit.musicFadeOutSeconds}:d=${edit.musicFadeOutSeconds}[music]`);
 if(edit.duckMusic){filters.push('[vo]asplit=2[voice][side]','[music][side]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=300[score]');}else filters.push('[vo]anull[voice]','[music]anull[score]');
 effects.forEach((e,i)=>filters.push(`[${n+5+i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${e.durationSeconds},asetpts=PTS-STARTPTS,volume=${e.gainDb+edit.effectGainDb}dB,adelay=${Math.round(e.startSeconds*1000)}|${Math.round(e.startSeconds*1000)},apad=whole_dur=60,atrim=duration=60[fx${i}]`));
 filters.push(`[voice][score]${effects.map((_,i)=>`[fx${i}]`).join('')}amix=inputs=${2+effects.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mix]`);
 return ['-hide_banner','-y',...inputs.flatMap(f=>['-i',f.path]),'-filter_complex',filters.join(';'),'-map','[mix]','-t','60','-c:a','pcm_s24le',out];
}
