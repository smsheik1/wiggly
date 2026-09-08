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
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
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

  // Presenter validation (optional)
  let presenterData = null;
  if (input.presenter && input.presenter.enabled) {
    const p = input.presenter;
    check(p.character === 'male' || p.character === 'female' || typeof p.character === 'object', 'presenter.character must be "male", "female", or an object with custom pose paths');

    const poseFiles = {};
    if (p.character === 'male' || p.character === 'female') {
      const charFolder = `assets/characters/${p.character}`;
      for (const poseName of ['neutral', 'laugh', 'talk', 'shock']) {
        const pPath = path.join(charFolder, `${poseName}.png`);
        const pFile = await media(inputDirectory, pPath);
        poseFiles[poseName] = pFile;
      }
    } else if (typeof p.character === 'object' && p.character.poses) {
      for (const [poseName, relPath] of Object.entries(p.character.poses)) {
        poseFiles[poseName] = await media(inputDirectory, relPath);
      }
      check(poseFiles.neutral, 'presenter poses must include at least neutral');
    }

    const swayCycle = positive(p.sway?.cycleSeconds) ? p.sway.cycleSeconds : 1.4;
    const maxAngleDeg = positive(p.sway?.maxAngleDeg) ? p.sway.maxAngleDeg : 2.2;
    const maxHorizontalPx = positive(p.sway?.maxHorizontalPx) ? p.sway.maxHorizontalPx : 16;
    const maxVerticalPx = positive(p.sway?.maxVerticalPx) ? p.sway.maxVerticalPx : 6;

    const cues = [];
    if (Array.isArray(p.cues) && p.cues.length > 0) {
      for (const [cIdx, cue] of p.cues.entries()) {
        check(typeof cue.atSeconds === 'number' && cue.atSeconds >= 0, `cue[${cIdx}].atSeconds must be non-negative`);
        check(typeof cue.pose === 'string' && poseFiles[cue.pose], `cue[${cIdx}].pose "${cue.pose}" not found in character poses`);
        cues.push({
          atSeconds: cue.atSeconds,
          pose: cue.pose,
          flip: Boolean(cue.flip)
        });
      }
      cues.sort((a, b) => a.atSeconds - b.atSeconds);
    } else {
      cues.push({ atSeconds: 0, pose: 'neutral', flip: false });
    }

    presenterData = {
      enabled: true,
      character: typeof p.character === 'string' ? p.character : 'custom',
      poseFiles,
      sway: {
        cycleSeconds: swayCycle,
        maxAngleDeg,
        maxHorizontalPx,
        maxVerticalPx
      },
      cues
    };
  }

  // Contacts validation
  const contactMap = new Map();
  if (Array.isArray(input.contacts)) {
    check(input.contacts.length <= 6, 'Provide at most 6 contacts');
    for (const c of input.contacts) {
      text(c.id, 'contact.id', 20);
      text(c.name, 'contact.name', 30);
      text(c.initial || c.name[0], 'contact.initial', 2);
      check(!contactMap.has(c.id), `Duplicate contact id: ${c.id}`);
      contactMap.set(c.id, c);
    }
  }

  // Scenes validation
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  check(scenes.length <= 10, 'Provide at most 10 scenes');
  if (scenes.length === 0) {
    check(input.hook.durationSeconds >= 3, 'When no dialogue scenes are provided, hook must be at least 3 seconds');
  }

  let totalDuration = input.hook.durationSeconds;
  const turnsList = [];

  for (const [sIndex, scene] of scenes.entries()) {
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
    totalDuration,
    presenterData
  };
}

export async function renderHookSvg(hook, hookAvatarFile, hookImageFile, hasPresenter = false) {
  const isDark = hook.theme === 'dark';
  const cardBg = isDark ? '#000000' : '#ffffff';
  const cardBorder = isDark ? 'stroke="#2f3336" stroke-width="2"' : '';
  const textPrimary = isDark ? '#f7f9f9' : '#0f1419';
  const textSecondary = isDark ? '#71767b' : '#536471';
  const dividerColor = isDark ? '#2f3336' : '#eff3f4';
  const shadowOpacity = isDark ? '0.6' : '0.45';

  const badgeColor = hook.badge === 'gold' ? '#e2b714' : '#1d9bf0';
  const badgeCheckColor = hook.badge === 'gold' ? '#000000' : '#ffffff';

  const lines = wrapText(hook.text, 36);
  const textSvgs = lines.map((line, i) =>
    `<text x="40" y="${180 + i * 44}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="400" fill="${textPrimary}">${escapeXml(line)}</text>`
  ).join('');

  const hasImage = Boolean(hookImageFile);
  const imgTop = 180 + lines.length * 44 + 20;
  const imgHeight = hasImage ? (hasPresenter ? 520 : 860) : 0;
  const statsTop = imgTop + imgHeight + 40;
  const cardHeight = statsTop + 140;
  const cardY = hasPresenter ? 160 : Math.max(80, Math.floor((H - cardHeight) / 2));

  // Convert hookImage to base64 if present
  let embeddedImage = '';
  if (hasImage) {
    const imgBuf = await sharp(hookImageFile).resize({ width: 860, height: imgHeight, fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
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
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
    </filter>
    <clipPath id="imgClip">
      <rect x="40" y="${imgTop}" width="860" height="${imgHeight}" rx="24"/>
    </clipPath>
    <clipPath id="avClip">
      <circle cx="86" cy="84" r="46"/>
    </clipPath>
  </defs>
  <g transform="translate(${CARD_X}, ${cardY})" filter="url(#shadow)">
    <rect width="${CARD_W}" height="${cardHeight}" rx="36" fill="${cardBg}" ${cardBorder}/>
    ${embeddedAvatar}
    <text x="150" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="${textPrimary}">${escapeXml(hook.authorName)}</text>
    <g transform="translate(${150 + hook.authorName.length * 20 + 15}, 48)">
      <circle cx="14" cy="14" r="13" fill="${badgeColor}"/>
      <path d="M8 14 l4 4 l8 -8" stroke="${badgeCheckColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <text x="150" y="115" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="400" fill="${textSecondary}">@${escapeXml(hook.handle)}</text>
    <text x="870" y="75" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="700" fill="${textSecondary}" text-anchor="end">···</text>
    ${textSvgs}
    ${embeddedImage}
    <text x="40" y="${statsTop}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="400" fill="${textSecondary}">${escapeXml(hook.timestamp || '12:02 PM · 08 Apr 24')} · <tspan font-weight="700" fill="${textPrimary}">${escapeXml(hook.views || '1.06M')}</tspan> Views</text>
    <line x1="40" y1="${statsTop + 25}" x2="900" y2="${statsTop + 25}" stroke="${dividerColor}" stroke-width="1.5"/>
    <text x="40" y="${statsTop + 65}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" fill="${textSecondary}"><tspan font-weight="700" fill="${textPrimary}">${escapeXml(hook.retweets || '12.5K')}</tspan> Retweets   <tspan font-weight="700" fill="${textPrimary}">${escapeXml(hook.quotes || '4,243')}</tspan> Quote Tweets   <tspan font-weight="700" fill="${textPrimary}">${escapeXml(hook.likes || '42.7K')}</tspan> Likes</text>
    <line x1="40" y1="${statsTop + 95}" x2="900" y2="${statsTop + 95}" stroke="${dividerColor}" stroke-width="1.5"/>
    <g transform="translate(60, ${statsTop + 115})">
      <path d="M0 0 h24 a12 12 0 0 1 12 12 v4 a12 12 0 0 1 -12 12 h-14 l-8 7 v-7 h-2 a12 12 0 0 1 -12 -12 v-4 a12 12 0 0 1 12 -12 z" fill="none" stroke="${textSecondary}" stroke-width="2" transform="scale(0.7)"/>
      <path d="M220 5 h30 l-6 -6 m6 6 l-6 6 M250 18 h-30 l6 -6 m-6 6 l6 6" fill="none" stroke="${textSecondary}" stroke-width="2.5"/>
      <path d="M460 12 c-6 -10 -18 -10 -24 0 c-6 10 12 24 24 30 c12 -6 30 -20 24 -30 c-6 -10 -18 -10 -24 0 z" fill="none" stroke="${textSecondary}" stroke-width="2" transform="translate(0, -6) scale(0.7)"/>
      <path d="M680 18 v-12 m0 0 l-5 5 m5 -5 l5 5 M670 14 v10 h20 v-10" fill="none" stroke="${textSecondary}" stroke-width="2"/>
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

function blendOverlay(cardBuf, charBuf) {
  const out = Buffer.from(cardBuf);
  const startY = 1140;
  const startIdx = startY * W * 4;
  const endIdx = W * H * 4;

  for (let i = startIdx; i < endIdx; i += 4) {
    const sA = charBuf[i + 3];
    if (sA === 0) continue;

    const dA = cardBuf[i + 3];
    if (dA === 0) {
      out[i] = charBuf[i];
      out[i + 1] = charBuf[i + 1];
      out[i + 2] = charBuf[i + 2];
      out[i + 3] = sA;
    } else if (sA === 255) {
      out[i] = charBuf[i];
      out[i + 1] = charBuf[i + 1];
      out[i + 2] = charBuf[i + 2];
      out[i + 3] = 255;
    } else {
      const sa = sA / 255;
      const da = dA / 255;
      const outA = sa + da * (1 - sa);
      out[i] = Math.round((charBuf[i] * sa + cardBuf[i] * da * (1 - sa)) / outA);
      out[i + 1] = Math.round((charBuf[i + 1] * sa + cardBuf[i + 1] * da * (1 - sa)) / outA);
      out[i + 2] = Math.round((charBuf[i + 2] * sa + cardBuf[i + 2] * da * (1 - sa)) / outA);
      out[i + 3] = Math.round(outA * 255);
    }
  }
  return out;
}

export async function render(inputFile, outputFile) {
  const source = await readFile(inputFile);
  const prepared = await validate(JSON.parse(source), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { input, gameplayFile, hookAudioFile, hookAvatarFile, hookImageFile, contactMap, turnsList, totalDuration, presenterData } = prepared;

  check(outputFile.endsWith('.mp4'), 'Output must be .mp4');
  check(!await lstat(outputFile).catch(() => null), 'Output exists; use a new path');
  await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });

  const hasPresenter = Boolean(presenterData?.enabled);

  // 1. Pre-render all distinct overlay state buffers
  const hookBuffer = await renderHookSvg(input.hook, hookAvatarFile, hookImageFile, hasPresenter);

  const sceneStateBuffers = [];
  for (const scene of (input.scenes || [])) {
    const contact = contactMap.get(scene.contactId);
    const sceneStates = [];
    for (let i = 1; i <= scene.turns.length; i++) {
      const activeTurns = scene.turns.slice(0, i);
      const buf = await renderChatSvg(contact, activeTurns);
      sceneStates.push(buf);
    }
    sceneStateBuffers.push(sceneStates);
  }

  // 2. Build time intervals for cards
  const overlayTimeline = [];
  overlayTimeline.push({
    start: 0,
    end: input.hook.durationSeconds,
    buffer: hookBuffer
  });

  let currentTurnIndex = 0;
  for (let sIdx = 0; sIdx < (input.scenes || []).length; sIdx++) {
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

  // 3. Pre-render character sway frames if presenter is enabled
  const swayCache = new Map();
  let N_SWAY = 35;

  if (hasPresenter) {
    const poseB64 = {};
    for (const [poseName, filePath] of Object.entries(presenterData.poseFiles)) {
      const buf = await readFile(filePath);
      poseB64[poseName] = buf.toString('base64');
    }

    N_SWAY = Math.round(presenterData.sway.cycleSeconds * FPS);
    const { maxAngleDeg, maxHorizontalPx, maxVerticalPx } = presenterData.sway;

    // Collect all unique (pose, flip) combinations used in cues
    const uniqueCombos = new Set(presenterData.cues.map(c => `${c.pose}_${c.flip ? '1' : '0'}`));

    for (const combo of uniqueCombos) {
      const [poseName, flipFlag] = combo.split('_');
      const flip = flipFlag === '1';
      const b64 = poseB64[poseName];
      const frames = [];
      const scaleX = flip ? -1 : 1;

      for (let f = 0; f < N_SWAY; f++) {
        const phase = (f / N_SWAY) * Math.PI * 2;
        const angle = (maxAngleDeg * Math.sin(phase)).toFixed(2);
        const dx = (maxHorizontalPx * Math.sin(phase)).toFixed(1);
        const dy = (maxVerticalPx * Math.abs(Math.sin(phase))).toFixed(1);

        const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="charShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
            </filter>
          </defs>
          <g transform="translate(${540 + Number(dx)}, ${1920 + Number(dy)}) rotate(${angle}) scale(${scaleX}, 1) translate(-360, -720)" filter="url(#charShadow)">
            <image href="data:image/png;base64,${b64}" width="720" height="720"/>
          </g>
        </svg>`;

        const rawBuf = await sharp(Buffer.from(svg)).raw().toBuffer();
        frames.push(rawBuf);
      }
      swayCache.set(combo, frames);
    }
  }

  // Helper to get active cue at time t
  function getActiveCue(t) {
    if (!hasPresenter) return null;
    let active = presenterData.cues[0];
    for (const cue of presenterData.cues) {
      if (cue.atSeconds <= t) {
        active = cue;
      } else {
        break;
      }
    }
    return active;
  }

  // 4. Audio & SFX mixing setup
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
  filterParts.push(`[0:v]trim=duration=${totalDuration.toFixed(3)},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}[base]`);
  filterParts.push(`[base][${overlayInputIndex}:v]overlay=0:0:format=auto[vout]`);

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
    let cardBuf = overlayTimeline[overlayTimeline.length - 1].buffer;
    for (const seg of overlayTimeline) {
      if (t >= seg.start && t < seg.end) {
        cardBuf = seg.buffer;
        break;
      }
    }

    let finalBuf = cardBuf;
    if (hasPresenter) {
      const cue = getActiveCue(t);
      const comboKey = `${cue.pose}_${cue.flip ? '1' : '0'}`;
      const swayFrames = swayCache.get(comboKey);
      const charFrame = swayFrames[f % N_SWAY];
      finalBuf = blendOverlay(cardBuf, charFrame);
    }

    const ok = ffmpeg.stdin.write(finalBuf);
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
    scenesCount: (input.scenes || []).length,
    presenter: hasPresenter ? {
      character: presenterData.character,
      cuesCount: presenterData.cues.length
    } : null,
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
