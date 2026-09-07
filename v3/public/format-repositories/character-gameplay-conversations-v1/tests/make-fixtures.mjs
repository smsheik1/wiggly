import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'assets'),{recursive:true});
const ffmpeg=args=>execFileSync('ffmpeg',['-v','error','-n',...args],{stdio:'inherit'});
// These original diagnostic patterns are video files supplied to the official renderer.
for(const [name,source]of [['warm','testsrc2=size=640x640:rate=25:duration=8'],['cool','testsrc=size=640x640:rate=25:duration=8']])ffmpeg(['-f','lavfi','-i',source,'-c:v','libx264','-threads','1','-pix_fmt','yuv420p',path.join(root,`assets/${name}.mp4`)]);
for(const [name,hz]of [['low',220],['high',440],['bright',660],['soft',330]])ffmpeg(['-f','lavfi','-i',`sine=frequency=${hz}:sample_rate=48000:duration=2`,'-c:a','pcm_s16le',path.join(root,`assets/${name}.wav`)]);
