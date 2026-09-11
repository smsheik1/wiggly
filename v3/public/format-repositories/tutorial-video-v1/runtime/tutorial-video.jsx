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
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: `translate(-50%, -50%) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
          width: 480,
          height: 854,
          overflow: "hidden",
          borderRadius: 28,
          border: `3px solid ${COLORS.lime}`,
          background: "#000",
          boxShadow: "0 34px 110px rgba(0,0,0,.7), 0 0 50px rgba(196,255,57,.25)",
          opacity: enter,
        }}
      >
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

function SocialProof({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          A ready-made video format your coding agent can run.
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 215, height: 690, display: "grid", gridTemplateColumns: "1fr 90px 1fr", alignItems: "center", gap: 24, opacity: enter }}>
        <div style={{ height: "100%", background: "#fff", borderRadius: 24, overflow: "hidden", border: "2px solid rgba(255,255,255,.25)", boxShadow: "0 24px 70px rgba(0,0,0,.5)", position: "relative" }}>
          <div style={{ position: "absolute", left: 24, top: 18, zIndex: 10, display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,.85)", padding: "6px 14px", borderRadius: 999, color: "#fff", fontSize: 14, fontWeight: 800 }}>
            <span>@mugsyclips — ORIGINAL</span>
          </div>
          <Img src={staticFile(step.media?.file || "mugsy-explains/mugsyclips-profile.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 20px", background: "linear-gradient(to top, rgba(0,0,0,.92), transparent)", color: "#fff" }}>
            <div style={{ fontSize: 18, fontWeight: 850 }}>Mugsy Explains Viral Concept</div>
            <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 2 }}>35.1K Followers • Millions of Views on A-vs-B Comparisons</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: COLORS.lime, color: COLORS.ink, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 950, boxShadow: "0 0 30px rgba(196,255,57,.5)" }}>
            →
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.lime, letterSpacing: ".1em", textAlign: "center" }}>SAME FORMULA</div>
        </div>

        <div style={{ height: "100%", background: "#111513", borderRadius: 24, overflow: "hidden", border: `2px solid ${COLORS.lime}`, boxShadow: "0 24px 70px rgba(0,0,0,.6)", position: "relative", display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", left: 24, top: 18, zIndex: 10, display: "flex", alignItems: "center", gap: 10, background: COLORS.lime, padding: "6px 14px", borderRadius: 999, color: COLORS.ink, fontSize: 14, fontWeight: 900 }}>
            <span>WIGGLY — MUGSY EXPLAINS</span>
          </div>
          <div style={{ width: 330, height: 586, borderRadius: 20, overflow: "hidden", border: "2px solid rgba(255,255,255,.2)" }}>
            <OffthreadVideo src={staticFile("mugsy-explains/final-result.mp4")} startFrom={0} muted={true} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 20px", background: "linear-gradient(to top, rgba(0,0,0,.92), transparent)", color: "#fff" }}>
            <div style={{ fontSize: 18, fontWeight: 850 }}>100% Deterministic Code</div>
            <div style={{ fontSize: 14, color: COLORS.lime, marginTop: 2 }}>Packaged poses + handwriting + audio sync</div>
          </div>
        </div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function PackageBreakdown({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  const poses = [
    { name: "COFFEE EXPLAIN", file: "mugsy-explains/poses/coffee-explain.png", label: "Pose 1: Intro / Hook" },
    { name: "POINT LEFT", file: "mugsy-explains/poses/point-left.png", label: "Pose 2: Contrast A" },
    { name: "POINT RIGHT", file: "mugsy-explains/poses/point-right.png", label: "Pose 3: Contrast B" },
    { name: "QUESTION", file: "mugsy-explains/poses/question.png", label: "Pose 4: Lesson Reveal" },
    { name: "RAISE HAND", file: "mugsy-explains/poses/raise-hand.png", label: "Pose 5: Conclusion" },
  ];
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: ".15em", color: COLORS.lime }}>COMPLETE WIGGLY PACKAGE</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          Characters, poses, and handwriting — included.
        </div>
      </div>

      <div style={{ position: "absolute", right: 84, top: 130, opacity: enter, background: COLORS.lime, color: COLORS.ink, padding: "8px 18px", borderRadius: 999, fontWeight: 950, fontSize: 14, letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 8 }}>
        <span>✔ NO IMAGE GENERATOR REQUIRED</span>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 220, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, opacity: enter }}>
        {poses.map((p) => (
          <div key={p.name} style={{ background: "#fff", borderRadius: 20, padding: "16px 12px", border: "2px solid rgba(255,255,255,.3)", boxShadow: "0 18px 50px rgba(0,0,0,.4)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ height: 350, width: "100%", display: "grid", placeItems: "center" }}>
              <Img src={staticFile(p.file)} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ marginTop: 14, fontSize: 15, fontWeight: 900, color: COLORS.ink }}>{p.name}</div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: "#64748b" }}>{p.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 125, background: "rgba(8,11,9,.9)", border: "2px solid rgba(196,255,57,.4)", borderRadius: 16, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: enter }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.lime }}>5 Expressive Poses • Virgil Handwritten Font • Dual-Panel Dynamic Layout</div>
        <div style={{ fontSize: 15, fontWeight: 900, background: COLORS.lime, color: COLORS.ink, padding: "6px 14px", borderRadius: 999 }}>$0 GENERATION FEES</div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function ReplacementValue({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  const cards = [
    { title: "IMAGE MODEL", status: "NOT NEEDED", desc: "Line art and poses are bundled as local SVG/PNG" },
    { title: "VIDEO MODEL", status: "NOT NEEDED", desc: "Remotion compositor handles timing and animation" },
    { title: "DEDICATED GPU", status: "NOT NEEDED", desc: "Runs locally on any Mac Mini M4 or standard CPU" }
  ];
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: ".15em", color: COLORS.lime }}>THE FORMAT RUNS LOCALLY</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          No generation credits.
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 230, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, opacity: enter }}>
        {cards.map((c) => (
          <div key={c.title} style={{ background: "#fff", color: COLORS.ink, borderRadius: 24, padding: "36px 30px", border: "2px solid rgba(255,255,255,.4)", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: COLORS.lime, color: COLORS.ink, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 950 }}>✔</div>
            <div style={{ marginTop: 24, fontSize: 26, fontWeight: 950, letterSpacing: "-.02em" }}>{c.title}</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: "#15803d", letterSpacing: ".06em" }}>{c.status}</div>
            <div style={{ marginTop: 14, fontSize: 17, color: "#475569", lineHeight: 1.45 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 125, background: COLORS.lime, color: COLORS.ink, borderRadius: 16, padding: "20px 28px", border: `3px solid ${COLORS.ink}`, boxShadow: `8px 8px 0 ${COLORS.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: enter }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Characters, poses, typography, and renderer are already packaged.</div>
        <div style={{ fontSize: 32, fontWeight: 950 }}>$0</div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function Scorecard({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  const items = [
    { name: "VIDEO", status: "PASSED", sub: "1920x1080 30fps" },
    { name: "AUDIO", status: "PASSED", sub: "Clean 48kHz stereo" },
    { name: "CHARACTER POSES", status: "PASSED", sub: "Exact lesson alignment" },
    { name: "FINAL MP4", status: "PASSED", sub: "Verified 0 providers" }
  ];
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: ".15em", color: COLORS.lime }}>ONE FINAL SCORE</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          Everything gets checked.
        </div>
      </div>

      <div style={{ position: "absolute", right: 84, top: 120, fontSize: 64, fontWeight: 950, color: COLORS.lime, opacity: enter }}>
        13/13
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 230, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, opacity: enter }}>
        {items.map((it) => (
          <div key={it.name} style={{ background: "#fff", color: COLORS.ink, borderRadius: 22, padding: "32px 24px", border: "2px solid rgba(255,255,255,.4)", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: COLORS.lime, color: COLORS.ink, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 950 }}>✔</div>
            <div style={{ marginTop: 20, fontSize: 22, fontWeight: 950 }}>{it.name}</div>
            <div style={{ marginTop: 4, fontSize: 15, fontWeight: 800, color: "#15803d" }}>{it.status}</div>
            <div style={{ marginTop: 10, fontSize: 15, color: "#64748b" }}>{it.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 125, background: COLORS.lime, color: COLORS.ink, borderRadius: 16, padding: "20px 28px", border: `3px solid ${COLORS.ink}`, boxShadow: `8px 8px 0 ${COLORS.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: enter }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Review once. Approve the finished file.</div>
        <div style={{ fontSize: 16, fontWeight: 950, background: COLORS.ink, color: COLORS.lime, padding: "8px 18px", borderRadius: 999 }}>{format.outputLabel.toUpperCase()} • READY</div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function BeginnerChecklist({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  const agents = [
    { label: "ANTIGRAVITY", logo: "media/fixed/agent-logos/antigravity.svg", bg: "#fff", color: "#4285F4" },
    { label: "CODEX", logo: "media/fixed/agent-logos/codex.svg", bg: "#fff", color: "#000" },
    { label: "CLAUDE CODE", logo: "media/fixed/agent-logos/claude.svg", bg: "#fff", color: "#D97757" },
    { label: "CURSOR", logo: "media/fixed/agent-logos/cursor.svg", bg: "#fff", color: "#000" },
  ];
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: ".15em", color: COLORS.lime }}>BEGINNER CHECKLIST</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          Pick a topic, three lessons, and a coding agent.
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 225, height: 490, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, opacity: enter }}>
        <div style={{ background: "#fff", color: COLORS.ink, borderRadius: 22, padding: "26px", border: "2px solid rgba(255,255,255,.4)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", letterSpacing: ".08em" }}>1 • PICK A TOPIC</div>
          <div style={{ marginTop: 14, fontSize: 24, fontWeight: 900 }}>Prompt vs Format</div>
          <div style={{ marginTop: 8, fontSize: 15, color: "#475569", lineHeight: 1.4 }}>Start with any creative or technical concept with 3 A-vs-B differences.</div>
          <div style={{ marginTop: "auto", padding: "12px 16px", background: "#f1f5f9", borderRadius: 12, fontSize: 14, fontWeight: 700, color: COLORS.ink }}>e.g. CGI vs VFX, Rules vs Luck</div>
        </div>

        <div style={{ background: "#fff", color: COLORS.ink, borderRadius: 22, padding: "26px", border: "2px solid rgba(255,255,255,.4)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", letterSpacing: ".08em" }}>2 • CHOOSE 3 LESSONS</div>
          <div style={{ marginTop: 14, fontSize: 20, fontWeight: 900, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10, borderLeft: `4px solid ${COLORS.lime}` }}>1. Rules vs Prompts</div>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10, borderLeft: `4px solid ${COLORS.lime}` }}>2. Examples vs Luck</div>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10, borderLeft: `4px solid ${COLORS.lime}` }}>3. Tests vs Hope</div>
          </div>
        </div>

        <div style={{ background: "#fff", color: COLORS.ink, borderRadius: 22, padding: "26px", border: "2px solid rgba(255,255,255,.4)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#64748b", letterSpacing: ".08em" }}>3 • USE A CODING AGENT</div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {agents.map((ag) => (
              <div key={ag.label} style={{ background: "#0f172a", borderRadius: 12, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, background: ag.bg, borderRadius: 10, display: "grid", placeItems: "center", padding: 6 }}>
                  <Img src={staticFile(ag.logo)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textAlign: "center" }}>{ag.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", fontSize: 14, color: "#64748b", textAlign: "center" }}>Terminal & media access</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 125, background: COLORS.lime, color: COLORS.ink, borderRadius: 16, padding: "18px 26px", border: `3px solid ${COLORS.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: enter }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Start with a topic you want to teach, and your coding agent handles the rest.</div>
        <div style={{ fontSize: 16, fontWeight: 950, background: COLORS.ink, color: COLORS.lime, padding: "6px 16px", borderRadius: 999 }}>READY TO RUN</div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function WorkflowReplacement({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{ position: "absolute", left: 84, top: 125, opacity: enter }}>
        <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: ".15em", color: COLORS.lime }}>THE WHOLE WORKFLOW</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em", marginTop: 4 }}>
          One package replaces three separate tools.
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, top: 240, height: 460, display: "grid", gridTemplateColumns: "1fr 90px 1.4fr", alignItems: "center", gap: 20, opacity: enter }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {["ILLUSTRATION / DRAWING TOOL", "VOICE MODEL SUBSCRIPTION", "TIMELINE VIDEO EDITOR"].map((tool) => (
            <div key={tool} style={{ background: "#fff", color: COLORS.ink, borderRadius: 16, padding: "22px 28px", fontSize: 19, fontWeight: 900, boxShadow: "0 10px 30px rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{tool}</span>
              <span style={{ color: "#ef4444", fontWeight: 950 }}>✕</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", placeItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: COLORS.lime, color: COLORS.ink, display: "grid", placeItems: "center", fontSize: 32, fontWeight: 950, boxShadow: "0 0 30px rgba(196,255,57,.5)" }}>
            →
          </div>
        </div>

        <div style={{ background: COLORS.lime, color: COLORS.ink, borderRadius: 24, padding: "44px 40px", border: `3px solid ${COLORS.ink}`, boxShadow: `10px 10px 0 ${COLORS.ink}, 0 0 50px rgba(196,255,57,.3)`, display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", boxSizing: "border-box" }}>
          <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: ".12em" }}>AUTONOMOUS CODING AGENT PACKAGE</div>
          <div style={{ marginTop: 10, fontSize: 44, fontWeight: 950, letterSpacing: "-.04em", lineHeight: 1.05 }}>WIGGLY</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800 }}>Complete {format.name} Package</div>
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Packaged Poses", "Handwriting Engine", "0 Provider Fees", "Local Render"].map((tag) => (
              <span key={tag} style={{ background: COLORS.ink, color: COLORS.lime, padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 900 }}>✔ {tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 125, background: "rgba(8,11,9,.95)", border: "2px solid rgba(255,255,255,.2)", borderRadius: 16, padding: "18px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: enter }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>To try your own format, copy the prompt on Wiggly below.</div>
        <div style={{ fontSize: 16, fontWeight: 950, background: COLORS.lime, color: COLORS.ink, padding: "8px 20px", borderRadius: 999 }}>{format.url}</div>
      </div>

      {step.captions.length ? <Caption cues={step.captions} /> : null}
    </AbsoluteFill>
  );
}

function FinalResult({ step, format }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 150 } });
  return (
    <AbsoluteFill style={{ color: COLORS.white, fontFamily: FONT }}>
      <GridBackground variant={step.background || "lime"} />
      <StepBadge number={step.number} label={step.label} />
      
      <div style={{
        position: "absolute",
        left: "50%",
        top: "52%",
        transform: `translate(-50%, -50%) scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
        width: 480,
        height: 854,
        borderRadius: 28,
        overflow: "hidden",
        border: `3px solid ${COLORS.lime}`,
        boxShadow: "0 30px 100px rgba(0,0,0,.7), 0 0 50px rgba(196,255,57,.25)",
        background: "#000",
        opacity: enter,
      }}>
        <Media step={step} framed={false} />
      </div>

      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 46, padding: "10px 22px", borderRadius: 999, background: "rgba(8,11,9,.94)", border: "1px solid rgba(255,255,255,.2)", color: COLORS.lime, fontSize: 16, fontWeight: 950, letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 10, zIndex: 30 }}>
        <span>🎬 {format.outputLabel.toUpperCase()} — GENERATED IN 1 CLICK</span>
      </div>
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
  if (step.kind === "social-proof") return <SocialProof step={step} format={format} />;
  if (step.kind === "package-breakdown") return <PackageBreakdown step={step} format={format} />;
  if (step.kind === "replacement-value") return <ReplacementValue step={step} format={format} />;
  if (step.kind === "scorecard") return <Scorecard step={step} format={format} />;
  if (step.kind === "checklist") return <BeginnerChecklist step={step} format={format} />;
  if (step.kind === "workflow") return <WorkflowReplacement step={step} format={format} />;
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
