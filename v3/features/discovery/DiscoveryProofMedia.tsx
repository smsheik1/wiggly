import type { DiscoveryEntry } from "./types";
import { DiscoveryAudioArtwork } from "./DiscoveryAudioArtwork";

export function DiscoveryReferenceInset({
  entry,
  variant = "hero",
}: {
  entry: DiscoveryEntry;
  variant?: "hero" | "card";
}) {
  if (entry.media.kind !== "image" || !entry.media.referenceSrc) return null;

  const placement = variant === "card"
    ? "right-3 top-12 w-[23%]"
    : "right-[4%] top-[4%] w-[24%]";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-discovery-reference
      className={`absolute z-10 aspect-[3/4] rounded-[18%] border-4 border-white bg-white object-cover shadow-[0_5px_18px_rgba(8,8,23,0.32)] ${placement}`}
      src={entry.media.referenceSrc}
      alt={`Reference for ${entry.title}`}
    />
  );
}

export function DiscoveryProofMedia({
  entry,
  className,
  autoPlay = false,
}: {
  entry: DiscoveryEntry;
  className: string;
  autoPlay?: boolean;
}) {
  if (entry.media.kind === "image") {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={entry.media.src}
          alt={`${entry.brand}: ${entry.title}`}
        />
        <DiscoveryReferenceInset entry={entry} />
      </div>
    );
  }

  if (entry.media.kind === "audio") {
    return (
      <div className={`relative ${className}`}>
        <DiscoveryAudioArtwork entry={entry} className="absolute inset-0" />
        <audio
          className="absolute inset-x-5 bottom-5 z-10 w-[calc(100%-2.5rem)]"
          src={entry.media.src}
          controls
          preload="none"
        />
      </div>
    );
  }

  return (
    <video
      className={className}
      style={entry.media.aspectRatio === "3:4" ? { aspectRatio: "3 / 4", objectFit: "contain" } : undefined}
      src={entry.media.src}
      poster={entry.media.poster}
      autoPlay={autoPlay}
      muted
      loop
      controls
      playsInline
      preload={autoPlay ? "metadata" : "none"}
    />
  );
}
