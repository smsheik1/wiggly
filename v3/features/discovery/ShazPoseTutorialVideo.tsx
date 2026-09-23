"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

interface PoseCue {
  id: string;
  index: number;
  label: string;
  badge: string;
  startTime: number;
  durationFrames: number;
  rationale: string;
  accentColor: string;
}

const POSE_CUES: PoseCue[] = [
  {
    id: "neutral-listening",
    index: 1,
    label: "Neutral Listening",
    badge: "POSE 01/11",
    startTime: 0,
    durationFrames: 60,
    rationale: "Calm dialogue anchor · 1 universal rig scale",
    accentColor: "#52d6ff",
  },
  {
    id: "present",
    index: 2,
    label: "Present",
    badge: "POSE 02/11",
    startTime: 2.5,
    durationFrames: 45,
    rationale: "Welcoming gesture · open arm to OTS card",
    accentColor: "#52d6ff",
  },
  {
    id: "shrug",
    index: 3,
    label: "Shrug",
    badge: "POSE 03/11",
    startTime: 4.375,
    durationFrames: 48,
    rationale: "Skeptical disbelief & humorous shrug",
    accentColor: "#ffd9e9",
  },
  {
    id: "think",
    index: 4,
    label: "Think",
    badge: "POSE 04/11",
    startTime: 6.375,
    durationFrames: 45,
    rationale: "Analytical chin hold · side-eye glance",
    accentColor: "#52d6ff",
  },
  {
    id: "key-point",
    index: 5,
    label: "Key Point",
    badge: "POSE 05/11",
    startTime: 8.25,
    durationFrames: 51,
    rationale: "Deliberate 27-frame rise wind-up gesture",
    accentColor: "#c9ff55",
  },
  {
    id: "aha",
    index: 6,
    label: "Aha!",
    badge: "POSE 06/11",
    startTime: 10.375,
    durationFrames: 48,
    rationale: "Fast 13-frame eureka finger pop",
    accentColor: "#ffd9e9",
  },
  {
    id: "point",
    index: 7,
    label: "Point",
    badge: "POSE 07/11",
    startTime: 12.375,
    durationFrames: 46,
    rationale: "Direct camera callout emphasis",
    accentColor: "#52d6ff",
  },
  {
    id: "confident",
    index: 8,
    label: "Confident",
    badge: "POSE 08/11",
    startTime: 14.291,
    durationFrames: 47,
    rationale: "Hands-on-hips grounded anchor hold",
    accentColor: "#c9ff55",
  },
  {
    id: "excited-celebration",
    index: 9,
    label: "Excited Celebration",
    badge: "POSE 09/11",
    startTime: 16.25,
    durationFrames: 63,
    rationale: "Double-arm hype celebration bounce",
    accentColor: "#ffd9e9",
  },
  {
    id: "point-at-screen",
    index: 10,
    label: "Point at Screen",
    badge: "POSE 10/11",
    startTime: 18.875,
    durationFrames: 52,
    rationale: "Explicit OTS graphic callout across screen",
    accentColor: "#52d6ff",
  },
  {
    id: "chin-stroke-swagger",
    index: 11,
    label: "Chin Stroke Swagger",
    badge: "POSE 11/11",
    startTime: 21.041,
    durationFrames: 61,
    rationale: "Smug smirk · finger under chin swagger",
    accentColor: "#c9ff55",
  },
];

export function ShazPoseTutorialVideo({
  videoSrc = "/format-repositories/shaz-puppet-runtime-v1/goldens/pose-catalog-showcase/final.mp4",
  posterSrc = "/format-repositories/shaz-puppet-runtime-v1/goldens/pose-catalog-showcase/poster.jpg",
}: {
  videoSrc?: string;
  posterSrc?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      for (let i = POSE_CUES.length - 1; i >= 0; i--) {
        if (time >= POSE_CUES[i].startTime - 0.05) {
          setActiveCueIndex(i);
          break;
        }
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  const jumpToPose = (index: number) => {
    const video = videoRef.current;
    if (!video) return;
    const targetCue = POSE_CUES[index];
    if (!targetCue) return;

    video.currentTime = targetCue.startTime;
    setActiveCueIndex(index);
    video.play().catch(() => {
      // autoplay policy fallback
    });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const activeCue = POSE_CUES[activeCueIndex] ?? POSE_CUES[0];

  return (
    <div
      className="mt-8 overflow-hidden border-2 border-[#080817] bg-white shadow-[6px_6px_0_#080817]"
      data-testid="shaz-pose-science-tutorial"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#080817] bg-[#dff8ff] p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="border-2 border-[#080817] bg-[#080817] px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white">
              Official Rig Tutorial
            </span>
            <span className="border-2 border-[#080817] bg-[#c9ff55] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-[#080817]">
              11 Active Production Poses
            </span>
          </div>
          <h3 className="mt-2 text-[clamp(24px,3.8vw,36px)] font-black leading-tight tracking-[-0.03em] text-[#080817]">
            The Science of Poses: Complete Rig Inventory & Expression Tutorial
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause tutorial" : "Play tutorial"}
            className="inline-flex items-center gap-2 rounded-md border-2 border-[#080817] bg-[#080817] px-4 py-2 font-mono text-xs font-black text-white shadow-[3px_3px_0_#52d6ff] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#52d6ff]"
          >
            {isPlaying ? (
              <>
                <Pause className="size-3.5 fill-current" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" aria-hidden="true" />
                <span>Play Tutorial (23s)</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={restart}
            aria-label="Restart tutorial video"
            className="inline-flex size-9 items-center justify-center rounded-md border-2 border-[#080817] bg-white text-[#080817] shadow-[2px_2px_0_#080817] transition hover:bg-[#f5f1e8]"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main video area */}
      <div className="relative aspect-video w-full bg-[#080817]">
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          playsInline
          controls
          preload="metadata"
          className="h-full w-full object-contain"
        />
      </div>

      {/* Live Pose HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#080817] bg-[#fffdf8] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="border-2 border-[#080817] bg-[#52d6ff] px-2.5 py-1 font-mono text-xs font-black text-[#080817]">
            {activeCue.badge}
          </span>
          <span className="font-mono text-sm font-black text-[#080817]">
            {activeCue.label}
          </span>
          <span className="hidden text-xs font-bold text-[#596176] sm:inline">
            · {activeCue.rationale}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs font-bold text-[#596176]">
          <span>
            {Math.floor(currentTime / 60)}:
            {String(Math.floor(currentTime % 60)).padStart(2, "0")} / 0:23
          </span>
          <span className="rounded border border-[#080817]/20 bg-white px-2 py-0.5 text-[11px] font-black text-[#080817]">
            {activeCue.durationFrames} frames
          </span>
        </div>
      </div>

      {/* Interactive 11-Pose Scrubber Grid */}
      <div className="border-t-2 border-[#080817] bg-[#f5f1e8] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#667087]">
            Click any pose to inspect execution & HUD recipe:
          </p>
          <span className="font-mono text-[10px] font-bold text-[#596176]">
            Universal 1.0 rig scale & zero coordinate offset
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {POSE_CUES.map((cue, index) => {
            const isActive = index === activeCueIndex;
            return (
              <button
                key={cue.id}
                type="button"
                onClick={() => jumpToPose(index)}
                className={`flex flex-col justify-between rounded border-2 border-[#080817] p-2 text-left transition ${
                  isActive
                    ? "bg-[#080817] text-white shadow-[3px_3px_0_#52d6ff]"
                    : "bg-white text-[#080817] shadow-[2px_2px_0_#080817] hover:bg-[#fffdf8]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-[9px] font-black uppercase tracking-wider ${
                      isActive ? "text-[#52d6ff]" : "text-[#596176]"
                    }`}
                  >
                    {cue.badge}
                  </span>
                  <span
                    className={`font-mono text-[8px] font-bold ${
                      isActive ? "text-[#c9ff55]" : "text-[#667087]"
                    }`}
                  >
                    {cue.durationFrames}f
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] font-black leading-tight">
                  {cue.label}
                </div>
                <div
                  className={`mt-1 font-mono text-[9px] ${
                    isActive ? "text-white/70" : "text-[#596176]"
                  }`}
                >
                  0:{String(Math.floor(cue.startTime)).padStart(2, "0")}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
