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

const FONT = 'Patrick Hand, -apple-system, system-ui, sans-serif';

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
  style = {},
  active = false
}) {
  const resolvedImg = resolveStaticSrc(imageSrc);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        ...style
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 48,
          fontWeight: 900,
          color: '#18181b',
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 36,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: active
            ? '0 25px 60px rgba(0,0,0,0.18), 0 0 0 4px #18181b'
            : '0 15px 40px rgba(0,0,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #18181b'
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
          <div style={{ color: '#a1a1aa', fontSize: 24 }}>[Visual Card]</div>
        )}
      </div>
    </div>
  );
}

export function MugsyHost({ role, frame, fps }) {
  const poseMap = {
    a: 'point-left.png',
    b: 'point-right.png',
    question: 'question.png',
    explain_a: 'coffee-explain.png',
    explain_b: 'raise-hand.png'
  };

  const poseFile = poseMap[role] || 'coffee-explain.png';
  const poseSrc = resolveStaticSrc(`assets/poses/${poseFile}`);

  const bounce = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 220 }
  });

  const scale = interpolate(bounce, [0, 1], [0.92, 1.0]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: -20,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        width: 820,
        height: 820,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        zIndex: 20
      }}
    >
      <Img
        src={poseSrc}
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.15))'
        }}
      />
    </div>
  );
}

export function MugsyExplainsVideo({
  title,
  lessons = [],
  sentences = [],
  music
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the currently active sentence
  let currentSentence = sentences[0] || null;
  let sentenceStartFrame = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sStart = Math.round(s.startSeconds * fps);
    const sEnd = Math.round(s.endSeconds * fps);
    if (frame >= sStart && frame < sEnd) {
      currentSentence = s;
      sentenceStartFrame = sStart;
      break;
    }
    if (i === sentences.length - 1 && frame >= sEnd) {
      currentSentence = s;
      sentenceStartFrame = sStart;
    }
  }

  const lessonIdx = currentSentence ? currentSentence.lessonIndex : 0;
  const currentLesson = lessons[lessonIdx] || lessons[0] || {
    leftLabel: 'A',
    rightLabel: 'B',
    leftImage: '',
    rightImage: ''
  };

  const role = currentSentence ? currentSentence.role : 'explain_a';
  const isSplit = role === 'question' || role === 'explain_a' || role === 'explain_b';
  const showOnlyLeft = role === 'a';
  const showOnlyRight = role === 'b';

  const sentenceLocalFrame = frame - sentenceStartFrame;
  const enterSpring = spring({
    frame: sentenceLocalFrame,
    fps,
    config: { damping: 16, stiffness: 180 }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#fbfbfb',
        backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
        backgroundSize: '32px 32px',
        color: '#18181b',
        fontFamily: FONT,
        overflow: 'hidden'
      }}
    >
      {/* Audio Layer */}
      {sentences.map((sent, idx) => sent.audioSrc ? (
        <Audio
          key={idx}
          src={resolveStaticSrc(sent.audioSrc)}
          startFrom={0}
          endAt={Math.round(sent.durationSeconds * fps)}
          playbackRate={1}
        />
      ) : null)}

      {/* Optional Background Music */}
      {music && music.file ? (
        <Audio
          src={music.file}
          volume={music.volume || 0.12}
          loop
        />
      ) : null}

      {/* Top Cards Visual Area */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 60,
          right: 60,
          height: 800,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isSplit ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 40,
              width: '100%',
              opacity: enterSpring,
              transform: `scale(${interpolate(enterSpring, [0, 1], [0.96, 1])})`
            }}
          >
            <ProofCard
              label={currentLesson.leftLabel}
              imageSrc={currentLesson.leftImage}
              active={role === 'explain_a'}
            />
            <ProofCard
              label={currentLesson.rightLabel}
              imageSrc={currentLesson.rightImage}
              active={role === 'explain_b'}
            />
          </div>
        ) : showOnlyLeft ? (
          <div
            style={{
              width: 520,
              opacity: enterSpring,
              transform: `scale(${interpolate(enterSpring, [0, 1], [0.92, 1])})`
            }}
          >
            <ProofCard
              label={currentLesson.leftLabel}
              imageSrc={currentLesson.leftImage}
              active={true}
            />
          </div>
        ) : showOnlyRight ? (
          <div
            style={{
              width: 520,
              opacity: enterSpring,
              transform: `scale(${interpolate(enterSpring, [0, 1], [0.92, 1])})`
            }}
          >
            <ProofCard
              label={currentLesson.rightLabel}
              imageSrc={currentLesson.rightImage}
              active={true}
            />
          </div>
        ) : null}
      </div>

      {/* Subtitle Caption Area */}
      <div
        style={{
          position: 'absolute',
          top: 960,
          left: 60,
          right: 60,
          textAlign: 'center',
          zIndex: 30
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '14px 34px',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            borderRadius: 24,
            border: '3px solid #18181b',
            boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
            fontFamily: FONT,
            fontSize: 52,
            fontWeight: 900,
            color: '#18181b',
            lineHeight: 1.15,
            letterSpacing: '0.01em',
            maxWidth: 960
          }}
        >
          {currentSentence ? currentSentence.text : ''}
        </div>
      </div>

      {/* Cartoon Host Character */}
      <MugsyHost role={role} frame={sentenceLocalFrame} fps={fps} />
    </AbsoluteFill>
  );
}
