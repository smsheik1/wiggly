import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const layout = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 25,
  cardWidth: 940,
  cardX: 70,
  chatTop: 160
});

const { width: W, height: H, fps: FPS, cardWidth: CARD_W, cardX: CARD_X, chatTop: CHAT_TOP } = layout;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const check = (condition, message) => { if (!condition) throw new Error(message); };
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const positive = n => Number.isFinite(n) && n > 0;

function text(value, label, max = 280) {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label}: nonempty text up to ${max} characters required`);
  return value;
}

function relative(value) {
  check(typeof value === 'string' && !path.isAbsolute(value) && !/[\\:\x00-\x1f]/.test(value) && value.split('/').every(p => p && p !== '.' && p !== '..'), 'Media path must be portable and relative to the Format Repo root');
  return value;
}

async function media(root, value) {
  let current = root;
  for (const part of relative(value).split('/')) {
    current = path.join(current, part);
    check(!(await lstat(current)).isSymbolicLink(), 'Media symlinks are unsupported');
  }
  const info = await lstat(current);
  check(info.isFile(), `Media must be a regular file: ${value}`);
  check(info.size <= 100 * 1024 * 1024, `Each media file must be at most 100 MB: ${value}`);
  return current;
}

const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 }));

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'\"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '\"': return '&quot;';
      default: return c;
    }
  });
}

function wrapText(txt, maxChars = 28) {
  const words = txt.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function validate(input, inputDirectory) {
  check(input.schemaVersion === 1, 'schemaVersion must be 1');
  text(input.topic, 'topic', 100);

  // Gameplay validation
  check(input.gameplay?.authorized === true && typeof input.gameplay?.provenance === 'string' && input.gameplay.provenance.trim(), 'Explicit gameplay authorization and provenance required');
  const gameplayFile = await media(inputDirectory, input.gameplay.file);
  const gameplayProbe = probe(gameplayFile);
  check(gameplayProbe.streams.some(s => s.codec_type === 'video'), 'Gameplay needs a video stream');
  const gameplayDuration = Number(gameplayProbe.format.duration);

  // Hook validation
  check(typeof input.hook === 'object' && input.hook !== null, 'Hook object required');
  text(input.hook.authorName, 'hook.authorName', 40);
  text(input.hook.handle, 'hook.handle', 30);
  text(input.hook.text, 'hook.text', 280);
  check(positive(input.hook.durationSeconds), 'hook.durationSeconds must be positive');
  check(input.hook.audio?.authorized === true && typeof input.hook.audio?.provenance === 'string', 'Hook audio authorization and provenance required');
  const hookAudioFile = await media(inputDirectory, input.hook.audio.file);
  const hookAudioProbe = probe(hookAudioFile);
  check(hookAudioProbe.streams.some(s => s.codec_type === 'audio'), 'Hook audio requires an audio stream');
  check(Math.abs(Number(hookAudioProbe.format.duration) - input.hook.durationSeconds) <= 0.08, 'Hook audio duration must agree with hook.durationSeconds within 0.08s');

  let hookAvatarFile = null;
  if (input.hook.avatar) {
    hookAvatarFile = await media(inputDirectory, input.hook.avatar);
  }
  let hookImageFile = null;
  if (input.hook.image) {
    hookImageFile = await media(inputDirectory, input.hook.image);
  }

  // Contacts validation
  check(Array.isArray(input.contacts) && input.contacts.length >= 1 && input.contacts.length <= 6, 'Provide 1-6 contacts');
  const contactMap = new Map();
  for (const c of input.contacts) {
    text(c.id, 'contact.id', 20);
    text(c.name, 'contact.name', 30);
    text(c.initial || c.name[0], 'contact.initial', 2);
    check(!contactMap.has(c.id), `Duplicate contact id: ${c.id}`);
    contactMap.set(c.id, c);
  }

  // Scenes validation
  check(Array.isArray(input.scenes) && input.scenes.length >= 1 && input.scenes.length <= 10, 'Provide 1-10 scenes');
  let totalDuration = input.hook.durationSeconds;
  const turnsList = [];

  for (const [sIndex, scene] of input.scenes.entries()) {
    check(contactMap.has(scene.contactId), `Unknown contactId in scene ${sIndex}: ${scene.contactId}`);
    check(Array.isArray(scene.turns) && scene.turns.length >= 1 && scene.turns.length <= 15, `Scene ${sIndex} must have 1-15 turns`);
    for (const [tIndex, turn] of scene.turns.entries()) {
      text(turn.speaker, `scene[${sIndex}].turn[${tIndex}].speaker`, 20);
      text(turn.text, `scene[${sIndex}].turn[${tIndex}].text`, 280);
      check(positive(turn.durationSeconds), `scene[${sIndex}].turn[${tIndex}].durationSeconds must be positive`);
      check(turn.audio?.authorized === true && typeof turn.audio?.provenance === 'string', `scene[${sIndex}].turn[${tIndex}].audio requires explicit authorization and provenance`);
      const audioFile = await media(inputDirectory, turn.audio.file);
      const audioProbe = probe(audioFile);
      check(audioProbe.streams.some(s => s.codec_type === 'audio'), `Turn needs audio stream: ${turn.audio.file}`);
      check(Math.abs(Number(audioProbe.format.duration) - turn.durationSeconds) <= 0.08, `Audio duration mismatch in scene ${sIndex} turn ${tIndex}`);
      turnsList.push({
        ...turn,
        audioFile,
        sceneIndex: sIndex,
        turnIndex: tIndex,
        contactId: scene.contactId,
        startTime: totalDuration
      });
      totalDuration += turn.durationSeconds;
    }
  }

  check(totalDuration <= 90, 'Total conversation duration must not exceed 90 seconds');
  check(gameplayDuration + 0.05 >= totalDuration, `Supplied gameplay duration (${gameplayDuration.toFixed(2)}s) is shorter than conversation (${totalDuration.toFixed(2)}s)`);

  return {
    input,
    gameplayFile,
    hookAudioFile,
    hookAvatarFile,
    hookImageFile,
    contactMap,
    turnsList,
    totalDuration
  };
}

export async function renderHookSvg(hook, hookAvatarFile, hookImageFile) {
  const lines = wrapText(hook.text, 36);
  const textSvgs = lines.map((line, i) =>
    `<text x="40" y="${180 + i * 44}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="400" fill="#0f1419">${escapeXml(line)}</text>`
  ).join('');

  const hasImage = Boolean(hookImageFile);
  const imgTop = 180 + lines.length * 44 + 20;
  const imgHeight = hasImage ? 860 : 0;
  const statsTop = imgTop + imgHeight + 40;
  const cardHeight = statsTop + 140;
  const cardY = Math.max(80, Math.floor((H - cardHeight) / 2));

  // Convert hookImage to base64 if present
  let embeddedImage = '';
  if (hasImage) {
    const imgBuf = await sharp(hookImageFile).resize({ width: 860, height: 860, fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    embeddedImage = `<image href="data:image/jpeg;base64,${imgBuf.toString('base64')}" x="40" y="${imgTop}" width="860" height="${imgHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip)"/>`;
  }

  let embeddedAvatar = '';
  if (hookAvatarFile) {
    const avBuf = await sharp(hookAvatarFile).resize(92, 92).png().toBuffer();
    embeddedAvatar = `<image href="data:image/png;base64,${avBuf.toString('base64')}" x="40" y="38" width="92" height="92" clip-path="url(#avClip)"/>`;
  } else {
    embeddedAvatar = `<circle cx="86" cy="84" r="46" fill="#8e8e93"/><text x="86" y="98" font-family="-apple-system, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(hook.authorName[0])}</text>`;
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <clipPath id="imgClip">
      <rect x="40" y="${imgTop}" width="860" height="${imgHeight}" rx="24"/>
    </clipPath>
    <clipPath id="avClip">
      <circle cx="86" cy="84" r="46"/>
    </clipPath>
  </defs>
  <g transform="translate(${CARD_X}, ${cardY})" filter="url(#shadow)">
    <rect width="${CARD_W}" height="${cardHeight}" rx="36" fill="#ffffff"/>
    ${embeddedAvatar}
    <text x="150" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#0f1419">${escapeXml(hook.authorName)}</text>
    <g transform="translate(${150 + hook.authorName.length * 20 + 15}, 48)">
      <circle cx="14" cy="14" r="13" fill="#1d9bf0"/>
      <path d="M8 14 l4 4 l8 -8" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <text x="150" y="115" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="400" fill="#536471">@${escapeXml(hook.handle)}</text>
    <text x="870" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="700" fill="#536471" text-anchor="end">···</text>
    ${textSvgs}
    ${embeddedImage}
    <text x="40" y="${statsTop}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="400" fill="#536471">${escapeXml(hook.timestamp || '12:02 PM · 08 Apr 24')} · <tspan font-weight="700" fill="#0f1419">${escapeXml(hook.views || '1.06M')}</tspan> Views</text>
    <line x1="40" y1="${statsTop + 25}" x2="900" y2="${statsTop + 25}" stroke="#eff3f4" stroke-width="1.5"/>
    <text x="40" y="${statsTop + 65}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" fill="#536471"><tspan font-weight="700" fill="#0f1419">${escapeXml(hook.retweets || '12.5K')}</tspan> Retweets   <tspan font-weight="700" fill="#0f1419">${escapeXml(hook.quotes || '4,243')}</tspan> Quote Tweets   <tspan font-weight="700" fill="#0f1419">${escapeXml(hook.likes || '42.7K')}</tspan> Likes</text>
    <line x1="40" y1="${statsTop + 95}" x2="900" y2="${statsTop + 95}" stroke="#eff3f4" stroke-width="1.5"/>
    <g transform="translate(60, ${statsTop + 115})">
      <path d="M0 0 h24 a12 12 0 0 1 12 12 v4 a12 12 0 0 1 -12 12 h-14 l-8 7 v-7 h-2 a12 12 0 0 1 -12 -12 v-4 a12 12 0 0 1 12 -12 z" fill="none" stroke="#536471" stroke-width="2" transform="scale(0.7)"/>
      <path d="M220 5 h30 l-6 -6 m6 6 l-6 6 M250 18 h-30 l6 -6 m-6 6 l6 6" fill="none" stroke="#536471" stroke-width="2.5"/>
      <path d="M460 12 c-6 -10 -18 -10 -24 0 c-6 10 12 24 24 30 c12 -6 30 -20 24 -30 c-6 -10 -18 -10 -24 0 z" fill="none" stroke="#536471" stroke-width="2" transform="translate(0, -6) scale(0.7)"/>
      <path d="M680 18 v-12 m0 0 l-5 5 m5 -5 l5 5 M670 14 v10 h20 v-10" fill="none" stroke="#536471" stroke-width="2"/>
    </g>
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).raw().toBuffer();
}

export async function renderChatSvg(contact, turns) {
  let bubbleY = 170;
  const bubbleSvgElements = [];

  for (const turn of turns) {
    const isVictim = turn.speaker === 'victim';
    const lines = wrapText(turn.text, isVictim ? 28 : 34);
    const bubbleLineHeight = 44;
    const bubbleHeight = 36 + lines.length * bubbleLineHeight;

    const maxLineLen = Math.max(...lines.map(l => l.length));
    const bubbleWidth = Math.min(820, Math.max(160, maxLineLen * 20 + 56));

    const bubbleX = isVictim ? (CARD_W - bubbleWidth - 40) : 40;
    const fill = isVictim ? '#007aff' : '#e9e9eb';
    const textFill = isVictim ? '#ffffff' : '#000000';

    const textSvgs = lines.map((l, i) =>
      `<text x="${bubbleX + 28}" y="${bubbleY + 38 + i * bubbleLineHeight}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif" font-size="34" font-weight="400" fill="${textFill}">${escapeXml(l)}</text>`
    ).join('');

    bubbleSvgElements.push(`
      <rect x="${bubbleX}" y="${bubbleY}" width="${bubbleWidth}" height="${bubbleHeight}" rx="28" fill="${fill}"/>
      ${textSvgs}
    `);

    bubbleY += bubbleHeight + 20;
  }

  const totalCardHeight = Math.max(260, bubbleY + 20);

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g transform="translate(${CARD_X}, ${CHAT_TOP})" filter="url(#shadow)">
    <rect width="${CARD_W}" height="${totalCardHeight}" rx="36" fill="#ffffff"/>
    <g transform="translate(40, 75)">
      <path d="M16 4 L4 18 L16 32" stroke="#007aff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="42" cy="18" r="18" fill="#007aff"/>
      <text x="42" y="25" font-family="-apple-system, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">14</text>
    </g>
    <circle cx="${CARD_W / 2}" cy="60" r="38" fill="#8e8e93"/>
    <text x="${CARD_W / 2}" y="${60 + 13}" font-family="-apple-system, sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(contact.initial || contact.name[0])}</text>
    <text x="${CARD_W / 2}" y="122" font-family="-apple-system, sans-serif" font-size="22" font-weight="600" fill="#8e8e93" text-anchor="middle">${escapeXml(contact.name)} <tspan fill="#c7c7cc">&gt;</tspan></text>
    <g transform="translate(${CARD_W - 90}, 55)">
      <rect x="0" y="6" width="32" height="24" rx="6" fill="#007aff"/>
      <path d="M32 14 L44 6 L44 30 L32 22 Z" fill="#007aff"/>
    </g>
    <line x1="0" y1="145" x2="${CARD_W}" y2="145" stroke="#e5e5ea" stroke-width="1.5"/>
    ${bubbleSvgElements.join('')}
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).raw().toBuffer();
}

export async function render(inputFile, outputFile) {
  const source = await readFile(inputFile);
  const prepared = await validate(JSON.parse(source), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { input, gameplayFile, hookAudioFile, hookAvatarFile, hookImageFile, contactMap, turnsList, totalDuration } = prepared;

  check(outputFile.endsWith('.mp4'), 'Output must be .mp4');
  check(!await lstat(outputFile).catch(() => null), 'Output exists; use a new path');
  await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });

  // 1. Pre-render all distinct overlay state buffers
  const hookBuffer = await renderHookSvg(input.hook, hookAvatarFile, hookImageFile);

  const sceneStateBuffers = [];
  for (const scene of input.scenes) {
    const contact = contactMap.get(scene.contactId);
    const sceneStates = [];
    for (let i = 1; i <= scene.turns.length; i++) {
      const activeTurns = scene.turns.slice(0, i);
      const buf = await renderChatSvg(contact, activeTurns);
      sceneStates.push(buf);
    }
    sceneStateBuffers.push(sceneStates);
  }

  // 2. Build time intervals for overlays
  const overlayTimeline = [];
  overlayTimeline.push({
    start: 0,
    end: input.hook.durationSeconds,
    buffer: hookBuffer
  });

  let currentTurnIndex = 0;
  for (let sIdx = 0; sIdx < input.scenes.length; sIdx++) {
    const scene = input.scenes[sIdx];
    for (let tIdx = 0; tIdx < scene.turns.length; tIdx++) {
      const turn = scene.turns[tIdx];
      const start = turnsList[currentTurnIndex].startTime;
      const end = start + turn.durationSeconds;
      overlayTimeline.push({
        start,
        end,
        buffer: sceneStateBuffers[sIdx][tIdx]
      });
      currentTurnIndex++;
    }
  }

  // 3. Audio & SFX mixing setup
  // Audio sources:
  // 0: Gameplay (omitted in mix)
  // 1: Hook audio
  // 2..N+1: Turns audio
  // N+2: Pop SFX
  // N+3: Sent SFX
  const sfxPopPath = path.resolve(repoRoot, 'assets/sfx/pop.wav');
  const sfxSentPath = path.resolve(repoRoot, 'assets/sfx/sent.wav');

  const args = [
    '-v', 'error',
    '-y',
    '-threads', '2',
    '-protocol_whitelist', 'file,pipe',
    '-i', gameplayFile,
    '-protocol_whitelist', 'file,pipe',
    '-i', hookAudioFile
  ];

  for (const turn of turnsList) {
    args.push('-protocol_whitelist', 'file,pipe', '-i', turn.audioFile);
  }
  args.push('-protocol_whitelist', 'file,pipe', '-i', sfxPopPath);
  args.push('-protocol_whitelist', 'file,pipe', '-i', sfxSentPath);

  // Overlay piped input
  const overlayInputIndex = 1 + 1 + turnsList.length + 2;
  args.push(
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${W}x${H}`,
    '-framerate', String(FPS),
    '-protocol_whitelist', 'file,pipe',
    '-i', 'pipe:0'
  );

  // Filter graph
  const filterParts = [];
  // Video filter: scale & crop gameplay, overlay piped RGBA
  filterParts.push(`[0:v]trim=duration=${totalDuration.toFixed(3)},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}[base]`);
  filterParts.push(`[base][${overlayInputIndex}:v]overlay=0:0:format=auto[vout]`);

  // Audio filter: delay each clip to its start time and mix
  const popInputIndex = 1 + 1 + turnsList.length;
  const sentInputIndex = popInputIndex + 1;
  const audioDelays = [];

  // Hook audio at 0ms
  filterParts.push(`[1:a]adelay=0|0,apad=whole_dur=${totalDuration.toFixed(3)}[a_hook]`);
  audioDelays.push('[a_hook]');

  // Dialogue turns + SFX
  for (let idx = 0; idx < turnsList.length; idx++) {
    const turn = turnsList[idx];
    const ms = Math.round(turn.startTime * 1000);
    const audioIdx = 2 + idx;
    filterParts.push(`[${audioIdx}:a]adelay=${ms}|${ms},apad=whole_dur=${totalDuration.toFixed(3)}[a_turn_${idx}]`);
    audioDelays.push(`[a_turn_${idx}]`);

    // Add SFX for bubble pop
    const sfxIdx = (turn.speaker === 'victim') ? sentInputIndex : popInputIndex;
    filterParts.push(`[${sfxIdx}:a]adelay=${ms}|${ms},volume=0.6,apad=whole_dur=${totalDuration.toFixed(3)}[sfx_${idx}]`);
    audioDelays.push(`[sfx_${idx}]`);
  }

  filterParts.push(`${audioDelays.join('')}amix=inputs=${audioDelays.length}:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`);

  args.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', totalDuration.toFixed(3),
    outputFile
  );

  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  ffmpeg.stderr.on('data', chunk => { stderr += chunk; });

  const totalFrames = Math.ceil(totalDuration * FPS);

  for (let f = 0; f < totalFrames; f++) {
    const t = f / FPS;
    let matchingBuf = overlayTimeline[overlayTimeline.length - 1].buffer;
    for (const seg of overlayTimeline) {
      if (t >= seg.start && t < seg.end) {
        matchingBuf = seg.buffer;
        break;
      }
    }
    const ok = ffmpeg.stdin.write(matchingBuf);
    if (!ok) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }
  }
  ffmpeg.stdin.end();

  const code = await new Promise((resolve, reject) => {
    ffmpeg.on('close', resolve);
    ffmpeg.on('error', reject);
  });

  if (code !== 0) {
    throw new Error(`FFmpeg failed with code ${code}:\n${stderr}`);
  }

  // Create receipt
  const outProbe = probe(outputFile);
  const outVideo = outProbe.streams.find(s => s.codec_type === 'video');
  const outAudio = outProbe.streams.find(s => s.codec_type === 'audio');

  const receipt = {
    schemaVersion: 1,
    kind: 'format-render-receipt',
    inputSha256: digest(source),
    runtimeSha256: digest(await readFile(fileURLToPath(import.meta.url))),
    outputFile: path.basename(outputFile),
    outputSha256: digest(await readFile(outputFile)),
    totalDurationSeconds: Number(outProbe.format.duration),
    width: outVideo.width,
    height: outVideo.height,
    fps: FPS,
    videoCodec: outVideo.codec_name,
    audioCodec: outAudio.codec_name,
    turnsCount: turnsList.length,
    scenesCount: input.scenes.length,
    renderedAt: new Date().toISOString()
  };

  await writeFile(`${outputFile}.receipt.json`, JSON.stringify(receipt, null, 2));
  return receipt;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, inputFile, outputFile] = process.argv;
  if (!inputFile || !outputFile) {
    console.error('Usage: node runtime/render.mjs <input.json> <output.mp4>');
    process.exit(1);
  }
  render(inputFile, outputFile)
    .then(r => console.log('Render complete:', r))
    .catch(err => { console.error('Render failed:', err); process.exit(1); });
}
