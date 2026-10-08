import React, { useMemo } from "react";
import { useRenderAssetComponents } from "../../render/RenderAssetContext";
import type { FormatRenderProps } from "../types";
import type { MyPixarStoryAdScene, StoryBeatNumber } from "./types";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Beat-specific color grading overlays (Pixar lighting aesthetic)
const BEAT_ATMOSPHERIC_STYLES: Record<
  StoryBeatNumber,
  {
    gradient: string;
    ambientTint: string;
    tagline: string;
  }
> = {
  1: {
    gradient:
      "radial-gradient(circle at 60% 30%, rgba(255, 215, 120, 0.45) 0%, rgba(255, 160, 60, 0.25) 45%, rgba(30, 20, 10, 0.75) 100%)",
    ambientTint: "#FFDF9E",
    tagline: "Chapter 1: The Wonder Years (Age 8)",
  },
  2: {
    gradient:
      "linear-gradient(180deg, rgba(10, 20, 50, 0.4) 0%, rgba(30, 15, 60, 0.3) 50%, rgba(255, 110, 40, 0.35) 100%)",
    ambientTint: "#FF8C42",
    tagline: "Chapter 2: The Freedom Machine (Age 16)",
  },
  3: {
    gradient:
      "radial-gradient(circle at 50% 60%, rgba(255, 240, 200, 0.3) 0%, rgba(40, 50, 70, 0.5) 50%, rgba(10, 15, 25, 0.85) 100%)",
    ambientTint: "#E0E6ED",
    tagline: "Chapter 3: The Leap of Faith (Age 22)",
  },
  4: {
    gradient:
      "radial-gradient(circle at 40% 40%, rgba(255, 200, 160, 0.4) 0%, rgba(180, 80, 90, 0.25) 50%, rgba(30, 15, 25, 0.8) 100%)",
    ambientTint: "#FFB5A7",
    tagline: "Chapter 4: The Origin of Us (The Romance)",
  },
  5: {
    gradient:
      "radial-gradient(circle at 50% 30%, rgba(255, 235, 170, 0.5) 0%, rgba(240, 150, 80, 0.3) 55%, rgba(40, 20, 15, 0.8) 100%)",
    ambientTint: "#FFE3A8",
    tagline: "Chapter 5: What I Wish You Knew (Legacy)",
  },
};

export type MyPixarStoryFormatRenderProps = Partial<FormatRenderProps<MyPixarStoryAdScene>> & {
  scene: MyPixarStoryAdScene;
};

export function MyPixarStoryFormatRenderer({
  scene,
  timeSeconds = 0,
}: MyPixarStoryFormatRenderProps) {
  const { Image, Video } = useRenderAssetComponents();
  const storyboard = scene.layout.storyboard;
  const totalDuration = storyboard.totalDurationSeconds || 65;
  const sceneCount = storyboard.scenes.length || 5;
  const sceneDuration = totalDuration / sceneCount; // ~13 seconds per scene

  // Calculate Active Scene Index (0..4) and local timing
  const activeSceneIndex = clamp(
    Math.floor(timeSeconds / sceneDuration),
    0,
    sceneCount - 1
  ) as 0 | 1 | 2 | 3 | 4;

  const currentScene = storyboard.scenes[activeSceneIndex];
  const beatNumber = (activeSceneIndex + 1) as StoryBeatNumber;
  const atmospheric = BEAT_ATMOSPHERIC_STYLES[beatNumber];

  const sceneLocalTime = Math.max(0, timeSeconds - activeSceneIndex * sceneDuration);
  const sceneProgress = clamp(sceneLocalTime / sceneDuration, 0, 1);

  // Crossfade calculation (0.6s fade-in, 0.6s fade-out)
  const fadeDuration = 0.6;
  const fadeIn = clamp(sceneLocalTime / fadeDuration, 0, 1);
  const fadeOut = clamp((sceneDuration - sceneLocalTime) / fadeDuration, 0, 1);
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  // 2.5D Ken Burns Camera Transformation per Beat
  const kenBurnsTransform = useMemo(() => {
    switch (beatNumber) {
      case 1:
        // Slow push forward into childhood
        return `scale(${1 + sceneProgress * 0.12}) translateY(${-sceneProgress * 2}%)`;
      case 2:
        // Parallax horizontal cruise pan
        return `scale(1.08) translateX(${(-2 + sceneProgress * 4).toFixed(2)}%)`;
      case 3:
        // Slow push-in on the solitary figure
        return `scale(${1.02 + sceneProgress * 0.1})`;
      case 4:
        // Gentle diagonal drift under romantic lights
        return `scale(${1.05 + sceneProgress * 0.08}) translateX(${(1 - sceneProgress * 2).toFixed(2)}%)`;
      case 5:
        // Grand pull-out revealing the full family portrait
        return `scale(${1.14 - sceneProgress * 0.12})`;
      default:
        return "scale(1)";
    }
  }, [beatNumber, sceneProgress]);

  const activeVideoUrl = scene.layout.activeClipUrls?.[activeSceneIndex];
  const activeKeyframeUrl = scene.layout.activeKeyframeUrls?.[activeSceneIndex];

  return (
    <div
      data-format="my-pixar-story"
      data-pixar-beat={beatNumber}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#080B14",
        color: "#FFFFFF",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 1. VISUAL LAYER: SeaDance Video or Ken Burns Animated Scene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: sceneOpacity,
          transform: kenBurnsTransform,
          transition: "opacity 0.2s ease-out",
          transformOrigin: "center center",
        }}
      >
        {activeVideoUrl ? (
          <Video
            src={activeVideoUrl}
            clipTimeSeconds={sceneLocalTime}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : activeKeyframeUrl ? (
          <Image
            src={activeKeyframeUrl}
            alt={currentScene.beatTitle}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          /* Procedural 3D Pixar Stylized Backdrop (Zero-Asset Preview) */
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, #151C30 0%, #0C101F 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Ambient Animated Depth Rings */}
            <div
              style={{
                width: "70cqw",
                height: "70cqw",
                borderRadius: "50%",
                background: atmospheric.gradient,
                filter: "blur(40px)",
                opacity: 0.8,
              }}
            />
            {/* Visual Icon / Beat Anchor */}
            <div
              style={{
                position: "absolute",
                textAlign: "center",
                padding: "4cqw",
                maxWidth: "85%",
              }}
            >
              <div
                style={{
                  fontSize: "4.5cqw",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  color: atmospheric.ambientTint,
                  textTransform: "uppercase",
                  marginBottom: "1.5cqw",
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                {currentScene.ageLabel}
              </div>
              <div
                style={{
                  fontSize: "3.2cqw",
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.9)",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                {currentScene.beatTitle}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ATMOSPHERIC COLOR GRADING OVERLAY */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: atmospheric.gradient,
          mixBlendMode: "screen",
          opacity: 0.65 * sceneOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Cinematic Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at center, transparent 40%, rgba(5, 7, 15, 0.75) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* 3. DEDICATION HEADER & CHAPTER BADGE */}
      <div
        style={{
          position: "absolute",
          top: "4cqw",
          left: "5cqw",
          right: "5cqw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: sceneOpacity,
          pointerEvents: "none",
        }}
      >
        {/* Recipient & Subject Dedication */}
        <div
          style={{
            fontSize: "2.8cqw",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.8)",
            textShadow: "0 2px 6px rgba(0,0,0,0.8)",
          }}
        >
          {storyboard.subjectName ? `${storyboard.subjectName} • For ${storyboard.recipientName}` : `For ${storyboard.recipientName}`}
        </div>

        {/* Chapter Indicator */}
        <div
          style={{
            backgroundColor: "rgba(10, 15, 25, 0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid rgba(255, 255, 255, 0.2)`,
            borderRadius: "999px",
            padding: "1cqw 3cqw",
            fontSize: "2.5cqw",
            fontWeight: 600,
            color: atmospheric.ambientTint,
            letterSpacing: "0.04em",
          }}
        >
          {atmospheric.tagline}
        </div>
      </div>

      {/* 3b. VINTAGE SCRAPBOOK MEMORABILIA POLAROID (v2 Realism) */}
      {currentScene.scrapbookArtifact && (
        <div
          data-scrapbook-artifact={currentScene.scrapbookArtifact.id}
          style={{
            position: "absolute",
            top: "12cqw",
            right: "5cqw",
            backgroundColor: "#FFFFFF",
            padding: "1.2cqw 1.2cqw 2.8cqw 1.2cqw",
            borderRadius: "0.8cqw",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.4)",
            transform: "rotate(3.5deg)",
            maxWidth: "22cqw",
            opacity: sceneOpacity,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1/1",
              backgroundColor: "#E2E8F0",
              borderRadius: "0.4cqw",
              overflow: "hidden",
            }}
          >
            <Image
              src={currentScene.scrapbookArtifact.assetUrl}
              alt={currentScene.scrapbookArtifact.description}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <div
            style={{
              marginTop: "0.8cqw",
              fontSize: "1.8cqw",
              fontFamily: "sans-serif",
              fontWeight: 600,
              color: "#334155",
              textAlign: "center",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentScene.scrapbookArtifact.caption || currentScene.scrapbookArtifact.description}
          </div>
        </div>
      )}

      {/* 4. ANIMATED SUBTITLES / NARRATION SCRIPT OVERLAY */}
      <div
        style={{
          position: "absolute",
          bottom: "7cqw",
          left: "6cqw",
          right: "6cqw",
          display: "flex",
          justifyContent: "center",
          opacity: sceneOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(8, 12, 22, 0.75)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "3cqw",
            padding: "3cqw 4.5cqw",
            maxWidth: "90%",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div
            style={{
              fontSize: "3.4cqw",
              fontWeight: 500,
              lineHeight: 1.45,
              color: "#FFFFFF",
              letterSpacing: "0.01em",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)",
            }}
          >
            "{currentScene.narrationScript}"
          </div>
        </div>
      </div>

      {/* 5. SCENE PROGRESS STEPPER (DISCRETE DOTS AT TOP) */}
      <div
        style={{
          position: "absolute",
          top: "1.5cqw",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "1.5cqw",
          pointerEvents: "none",
        }}
      >
        {[0, 1, 2, 3, 4].map((idx) => {
          const isCurrent = idx === activeSceneIndex;
          const isPassed = idx < activeSceneIndex;
          return (
            <div
              key={idx}
              style={{
                width: isCurrent ? "5cqw" : "1.8cqw",
                height: "1cqw",
                borderRadius: "999px",
                backgroundColor: isCurrent
                  ? atmospheric.ambientTint
                  : isPassed
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(255, 255, 255, 0.25)",
                transition: "all 0.3s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
