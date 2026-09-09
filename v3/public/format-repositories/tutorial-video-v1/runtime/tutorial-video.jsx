import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  ink: "#080b09",
  lime: "#c4ff39",
  blue: "#52cbed",
  cream: "#f4efe4",
  white: "#ffffff",
  muted: "#aeb8b0",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace";
const GRID_ASSETS = {
  lime: "fixed/grid-acid-lime-v1.png",
  blue: "fixed/grid-electric-blue-v1.png",
  cream: "fixed/grid-warm-cream-v1.png",
};

function GridBackground({ variant }) {
  const dark = variant !== "cream";
  return (
    <AbsoluteFill style={{ background: dark ? COLORS.ink : COLORS.cream }}>
      <Img src={staticFile(GRID_ASSETS[variant])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ background: dark ? "rgba(5,8,6,.18)" : "rgba(244,239,228,.24)" }} />
    </AbsoluteFill>
  );
}

function StepBadge({ number, label, light = false }) {
  return (
    <div style={{
      position: "absolute",
      left: 68,
      top: 52,
      zIndex: 20,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "11px 18px 11px 12px",
      borderRadius: 999,
      background: light ? "rgba(255,255,255,.95)" : "rgba(8,11,9,.94)",
      color: light ? COLORS.ink : COLORS.white,
      border: "1px solid rgba(255,255,255,.22)",
      boxShadow: "0 14px 38px rgba(0,0,0,.28)",
      fontFamily: FONT,
      fontWeight: 850,
      fontSize: 21,
      letterSpacing: "-.02em",
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 19, display: "grid", placeItems: "center", background: COLORS.lime, color: COLORS.ink, fontWeight: 950 }}>{number}</div>
      {label.toUpperCase()}
    </div>
  );
}

function WindowChrome({ title, kind, children }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 19, stiffness: 150, mass: 0.8 } });
  const terminal = kind === "terminal";
  return (
    <div style={{
      position: "absolute",
      left: 84,
      right: 84,
      top: 144,
      height: 720,
      overflow: "hidden",
      borderRadius: 28,
      border: "2px solid rgba(255,255,255,.25)",
      background: terminal ? "#111513" : "#fff",
      boxShadow: "0 30px 100px rgba(0,0,0,.58)",
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px) scale(${interpolate(enter, [0, 1], [.985, 1])})`,
      fontFamily: FONT,
    }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", background: terminal ? "#202522" : "#f3f0e9", borderBottom: `1px solid ${terminal ? "#384039" : "#d8d5cf"}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((color) => <div key={color} style={{ width: 16, height: 16, borderRadius: 8, background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />)}
        <div style={{ position: "absolute", left: 260, right: 260, textAlign: "center", color: terminal ? "#d7ded8" : "#535954", fontFamily: terminal ? MONO : FONT, fontSize: 18, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function Media({ step, framed = true }) {
  if (!step.media) return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, Math.max(1, step.durationInFrames - 1)], [1.012, 1.045], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const style = {
    width: "100%",
    height: "100%",
    objectFit: step.media.fit,
    background: step.kind === "terminal" ? "#111513" : "#fff",
    transform: framed ? `scale(${zoom})` : undefined,
  };
  if (step.media.type === "image") return <Img src={staticFile(step.media.file)} style={style} />;
  return (
    <OffthreadVideo
      src={staticFile(step.media.file)}
      startFrom={Math.round(step.media.startSeconds * fps)}
      muted={!step.nativeAudio}
      volume={step.nativeAudio ? 1 : 0}
      style={style}
    />
  );
}

function CheckpointCard({ checkpoint }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame: frame - 18, fps: 30, config: { damping: 16, stiffness: 180, mass: .72 } });
  return (
    <div style={{
      position: "absolute",
      left: 96,
      right: 96,
      bottom: 128,
      zIndex: 24,
      minHeight: 92,
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: 24,
      padding: "19px 24px",
      boxSizing: "border-box",
      borderRadius: 18,
      border: `3px solid ${COLORS.ink}`,
      background: COLORS.lime,
      color: COLORS.ink,
      boxShadow: "8px 8px 0 rgba(8,11,9,.9), 0 0 42px rgba(196,255,57,.35)",
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
      fontFamily: FONT,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 950, letterSpacing: ".13em" }}>{checkpoint.eyebrow.toUpperCase()}</div>
        <div style={{ marginTop: 5, fontSize: 31, fontWeight: 900, letterSpacing: "-.03em" }}>{checkpoint.headline}</div>
      </div>
      <div style={{ padding: "9px 15px", borderRadius: 999, background: COLORS.ink, color: COLORS.lime, fontSize: 14, fontWeight: 950, letterSpacing: ".05em" }}>{checkpoint.badge.toUpperCase()}</div>
    </div>
  );
}

function Caption({ cues }) {
  const frame = useCurrentFrame();
  const cue = cues.find((item) => frame >= Math.round(item.start * 30) && frame < Math.round(item.end * 30));
  if (!cue) return null;
  const local = frame - Math.round(cue.start * 30);
  const enter = spring({ frame: local, fps: 30, config: { damping: 18, stiffness: 190, mass: .65 } });
  return (
    <div style={{
      position: "absolute",
      left: "50%",
      bottom: 54,
      zIndex: 30,
      maxWidth: 1480,
      padding: "14px 27px 16px",
      borderRadius: 20,
      background: "rgba(255,255,255,.97)",
      color: COLORS.ink,
      boxShadow: "0 14px 40px rgba(0,0,0,.3)",
      transform: `translate(-50%, ${interpolate(enter, [0, 1], [20, 0])}px)`,
      opacity: enter,
      fontFamily: FONT,
      fontSize: 38,
      fontWeight: 820,
      lineHeight: 1.08,
      letterSpacing: "-.03em",
      textAlign: "center",
      whiteSpace: "nowrap",
    }}>{cue.text}</div>
  );
}

function Hero({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background} />
      <div style={{ position: "absolute", left: 120, top: 238, width: 900, opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)` }}>
        <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: ".16em", color: COLORS.lime }}>SEE THE RESULT FIRST</div>
        <div style={{ marginTop: 20, fontSize: 82, lineHeight: .98, fontWeight: 900, letterSpacing: "-.055em" }}>{format.name}</div>
        <div style={{ marginTop: 30, maxWidth: 820, fontSize: 37, lineHeight: 1.18, fontWeight: 650, color: "#dce5de", letterSpacing: "-.025em" }}>{format.promise}</div>
      </div>
      <div style={{ position: "absolute", right: 160, top: 95, width: 500, height: 890, overflow: "hidden", borderRadius: 28, border: "2px solid rgba(255,255,255,.35)", background: "#000", boxShadow: "0 34px 110px rgba(0,0,0,.62)", opacity: enter }}>
        <Media step={step} framed={false} />
      </div>
      <StepBadge number={step.number} label={step.label} />
    </AbsoluteFill>
  );
}

function EndCard({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 145 } });
  return (
    <AbsoluteFill style={{ color: COLORS.ink, fontFamily: FONT, display: "grid", placeItems: "center", textAlign: "center" }}>
      <GridBackground variant="cream" />
      <div style={{ width: 1500, opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)` }}>
        <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: ".15em" }}>YOUR NEXT STEP</div>
        <div style={{ marginTop: 20, fontSize: 80, lineHeight: 1.04, fontWeight: 900, letterSpacing: "-.05em" }}>{step.label}</div>
        <div style={{ display: "inline-flex", marginTop: 40, padding: "16px 24px", border: `3px solid ${COLORS.ink}`, borderRadius: 16, background: COLORS.lime, boxShadow: `7px 7px 0 ${COLORS.ink}`, fontSize: 25, fontWeight: 900 }}>{format.url}</div>
      </div>
      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function FinalResult({ step, format }) {
  return (
    <AbsoluteFill style={{ background: "#000", color: COLORS.white, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Media step={step} framed={false} /></div>
      <div style={{ position: "absolute", left: 50, top: 42, padding: "10px 16px", borderRadius: 999, background: "rgba(8,11,9,.9)", color: COLORS.lime, fontSize: 17, fontWeight: 900, letterSpacing: ".08em" }}>{format.outputLabel.toUpperCase()}</div>
    </AbsoluteFill>
  );
}

function StandardStep({ step }) {
  const light = step.background === "cream";
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <GridBackground variant={step.background} />
      <WindowChrome title={step.windowTitle || (step.kind === "terminal" ? "Terminal — local Wiggly run" : "Wiggly — Format page")} kind={step.kind}>
        <Media step={step} />
      </WindowChrome>
      <StepBadge number={step.number} label={step.label} light={light} />
      {step.checkpoint ? <CheckpointCard checkpoint={step.checkpoint} /> : null}
      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function StepVisual({ step, format }) {
  if (step.kind === "hero") return <Hero step={step} format={format} />;
  if (step.kind === "final") return <FinalResult step={step} format={format} />;
  if (step.kind === "end") return <EndCard step={step} format={format} />;
  return <StandardStep step={step} />;
}

function Music({ input }) {
  const frame = useCurrentFrame();
  if (!input.music) return null;
  const section = input.steps.find((step) => frame >= step.startFrame && frame < step.startFrame + step.durationInFrames);
  const native = section?.nativeAudio;
  const fadeIn = interpolate(frame, [0, 24], [0, input.music.volume], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [input.durationInFrames - 36, input.durationInFrames], [input.music.volume, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={staticFile(input.music.file)} volume={native ? 0 : Math.min(fadeIn, fadeOut)} />;
}

function Progress() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = interpolate(frame, [0, durationInFrames - 1], [0, 1920], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ position: "absolute", left: 0, bottom: 0, zIndex: 40, width, height: 8, background: COLORS.lime, boxShadow: "0 -2px 14px rgba(196,255,57,.42)" }} />;
}

export function TutorialVideo(input) {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {input.steps.map((step) => (
        <Sequence key={step.id} from={step.startFrame} durationInFrames={step.durationInFrames} premountFor={30}>
          <StepVisual step={step} format={input.format} />
          {step.narration ? <Sequence from={Math.round(step.narration.startSeconds * input.fps)}><Audio src={staticFile(step.narration.file)} /></Sequence> : null}
        </Sequence>
      ))}
      <Music input={input} />
      <Progress />
    </AbsoluteFill>
  );
}
