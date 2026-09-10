import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

export function resolveStaticSrc(src) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  let clean = src;
  const marker = 'mugsy-explains-v1/';
  if (clean.includes(marker)) {
    clean = clean.split(marker)[1];
  }
  clean = clean.replace(/^\/+/, '');
  return staticFile(clean);
}

export function ProofCard({
  label,
  imageSrc,
  left,
  top,
  width = 420,
  height = 420,
  active = false,
  role = ''
}) {
  const resolvedImg = resolveStaticSrc(imageSrc);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Label */}
      <div
        style={{
          fontFamily: "'Patrick Hand', -apple-system, system-ui, sans-serif",
          fontSize: 52,
          fontWeight: 700,
          color: '#0c0c18',
          textTransform: 'capitalize',
          marginBottom: 16,
          lineHeight: 1
        }}
      >
        {label}
      </div>

      {/* Visual Card */}
      <div
        style={{
          width,
          height,
          borderRadius: 34,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: active
            ? '0 20px 45px rgba(0, 0, 0, 0.16), 0 0 0 4px #0c0c18'
            : '0 12px 30px rgba(0, 0, 0, 0.08)',
          border: '3px solid #0c0c18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: active ? 'scale(1.03)' : 'scale(1.0)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}
      >
        {resolvedImg ? (
          <Img
            src={resolvedImg}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 24, fontFamily: 'sans-serif' }}>[Visual Card]</div>
        )}
      </div>
    </div>
  );
}

export function MugsyHost({ role, frame, fps, chunkLocalFrame }) {
  const poseMap = {
    a: 'point-left.png',
    b: 'point-right.png',
    question: 'question.png',
    explain_a: 'coffee-explain.png',
    explain_b: 'raise-hand.png'
  };

  const poseFile = poseMap[role] || 'coffee-explain.png';
  const poseSrc = resolveStaticSrc(`assets/poses/${poseFile}`);

  // Dynamic pop bounce when pose/chunk changes
  const popSpring = spring({
    frame: chunkLocalFrame || 0,
    fps,
    config: { damping: 14, stiffness: 240 }
  });
  const popScale = interpolate(popSpring, [0, 1], [0.93, 1.0]);

  // Subtle natural cartoon breathing/talking bob (never static still)
  const bobY = Math.sin((frame * 2 * Math.PI) / 22) * 5;
  const bobTilt = Math.sin((frame * 2 * Math.PI) / 44) * 1.2;

  const topPos = role === 'question' ? 825 : 850;

  return (
    <div
      style={{
        position: 'absolute',
        top: topPos,
        left: '50%',
        transform: `translateX(-50%) translateY(${bobY}px) rotate(${bobTilt}deg) scale(${popScale})`,
        transformOrigin: 'bottom center',
        width: 1000,
        height: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 20
      }}
    >
      <Img
        src={poseSrc}
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
}

export function MugsyExplainsVideo({
  title,
  lessons = [],
  sentences = [],
  chunks = [],
  music,
  audioTrack
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeSec = frame / fps;

  // Find active chunk (rapid 2-4 word updates in sync with speech)
  let activeChunk = null;
  let chunkLocalFrame = 0;

  if (chunks && chunks.length > 0) {
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      if (currentTimeSec >= ch.startSeconds && currentTimeSec < ch.endSeconds) {
        activeChunk = ch;
        chunkLocalFrame = Math.max(0, Math.round((currentTimeSec - ch.startSeconds) * fps));
        break;
      }
      if (i === chunks.length - 1 && currentTimeSec >= ch.endSeconds) {
        activeChunk = ch;
        chunkLocalFrame = Math.max(0, Math.round((currentTimeSec - ch.startSeconds) * fps));
      }
    }
  }

  // Fallback to sentence timeline if chunks are absent
  if (!activeChunk && sentences && sentences.length > 0) {
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      if (currentTimeSec >= s.startSeconds && currentTimeSec < s.endSeconds) {
        activeChunk = {
          text: s.text,
          role: s.role,
          lessonIndex: s.lessonIndex,
          startSeconds: s.startSeconds,
          endSeconds: s.endSeconds
        };
        chunkLocalFrame = Math.max(0, Math.round((currentTimeSec - s.startSeconds) * fps));
        break;
      }
      if (i === sentences.length - 1 && currentTimeSec >= s.endSeconds) {
        activeChunk = {
          text: s.text,
          role: s.role,
          lessonIndex: s.lessonIndex,
          startSeconds: s.startSeconds,
          endSeconds: s.endSeconds
        };
        chunkLocalFrame = Math.max(0, Math.round((currentTimeSec - s.startSeconds) * fps));
      }
    }
  }

  if (!activeChunk) {
    activeChunk = {
      text: title || 'Mugsy Explains',
      role: 'explain_a',
      lessonIndex: 0,
      startSeconds: 0,
      endSeconds: 999
    };
  }

  const lessonIdx = activeChunk.lessonIndex || 0;
  const currentLesson = lessons[lessonIdx] || lessons[0] || {
    leftLabel: 'A',
    rightLabel: 'B',
    leftImage: '',
    rightImage: ''
  };

  const role = activeChunk.role || 'explain_a';
  const isSplit = role === 'question' || role === 'explain_a' || role === 'explain_b';
  const showOnlyLeft = role === 'a';
  const showOnlyRight = role === 'b';

  const fontUrl = resolveStaticSrc('assets/fonts/PatrickHand-Regular.ttf');

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @font-face {
          font-family: 'Patrick Hand';
          src: url('${fontUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `}</style>

      {/* Audio Track */}
      {audioTrack ? (
        <Audio src={resolveStaticSrc(audioTrack)} />
      ) : null}

      {/* Optional Background Music */}
      {music && music.file ? (
        <Audio
          src={resolveStaticSrc(music.file)}
          volume={music.volume || 0.12}
          loop
        />
      ) : null}

      {/* Proof Cards Display */}
      {isSplit ? (
        <>
          <ProofCard
            label={currentLesson.leftLabel}
            imageSrc={currentLesson.leftImage}
            left={80}
            top={72}
            width={410}
            height={410}
            active={role === 'explain_a'}
            role={role}
          />
          <ProofCard
            label={currentLesson.rightLabel}
            imageSrc={currentLesson.rightImage}
            left={590}
            top={72}
            width={410}
            height={410}
            active={role === 'explain_b'}
            role={role}
          />
        </>
      ) : showOnlyLeft ? (
        <ProofCard
          label={currentLesson.leftLabel}
          imageSrc={currentLesson.leftImage}
          left={330}
          top={80}
          width={420}
          height={420}
          active={true}
          role={role}
        />
      ) : showOnlyRight ? (
        <ProofCard
          label={currentLesson.rightLabel}
          imageSrc={currentLesson.rightImage}
          left={330}
          top={80}
          width={420}
          height={420}
          active={true}
          role={role}
        />
      ) : null}

      {/* Dynamic Chunk-by-Chunk Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 610,
          left: 60,
          right: 60,
          textAlign: 'center',
          zIndex: 30,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <span
          style={{
            fontFamily: "'Patrick Hand', -apple-system, system-ui, sans-serif",
            fontSize: 84,
            fontWeight: 700,
            color: '#0c0c18',
            lineHeight: 1.15,
            maxWidth: 960,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}
        >
          {activeChunk.text}
        </span>
      </div>

      {/* Mugsy Cartoon Host */}
      <MugsyHost
        role={role}
        frame={frame}
        fps={fps}
        chunkLocalFrame={chunkLocalFrame}
      />
    </AbsoluteFill>
  );
}
