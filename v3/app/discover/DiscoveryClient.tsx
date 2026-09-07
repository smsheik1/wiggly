"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  Search,
  Share2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  filterDiscoveryEntries,
  groupDiscoveryEntriesByShelf,
} from "@/features/discovery/catalog";
import { DiscoveryAudioArtwork } from "@/features/discovery/DiscoveryAudioArtwork";
import { DiscoveryReferenceInset } from "@/features/discovery/DiscoveryProofMedia";
import {
  readSavedDiscoveryIds,
  writeSavedDiscoveryIds,
} from "@/features/discovery/savedAds";
import {
  playbackPaused,
  playbackStarted,
  playbackSynced,
  type DiscoveryPlaybackState,
} from "@/features/discovery/playbackState";
import type { DiscoveryEntry, DiscoveryGoal } from "@/features/discovery/types";
import styles from "./discovery.module.css";

const goalFilters: Array<{ id: DiscoveryGoal; label: string }> = [
  { id: "all", label: "For you" },
  { id: "sell", label: "Sell a product" },
  { id: "explain", label: "Explain it" },
  { id: "story", label: "Tell a story" },
  { id: "teach", label: "Teach" },
  { id: "entertain", label: "Entertain" },
];

const ownerTokenStorageKey = "wiggly-owner-access-token";
const maxAmbientVideoPreviews = 2;
const ambientPreviewVisibilityThreshold = 0.6;

export function DiscoveryClient({
  entries,
  savedOnly = false,
}: {
  entries: DiscoveryEntry[];
  savedOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState<DiscoveryGoal>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activePlayback, setActivePlayback] = useState<DiscoveryPlaybackState>(null);
  const [curationMode, setCurationMode] = useState(false);
  const [toast, setToast] = useState("");
  const activePlaybackRef = useRef<DiscoveryPlaybackState>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const shelfRefs = useRef(new Map<string, HTMLDivElement>());
  const hiddenEntryIds = useQuery(api.discoveryModeration.listHidden, {}) || [];
  const hideDiscoveryEntry = useMutation(api.discoveryModeration.hide);

  useEffect(() => {
    setSavedIds(readSavedDiscoveryIds(window.localStorage));
    setCurationMode(new URLSearchParams(window.location.search).get("curate") === "1");
  }, []);

  const visibleEntries = useMemo(() => {
    const filtered = filterDiscoveryEntries(entries, query, goal);
    const hidden = new Set(hiddenEntryIds);
    const publicEntries = filtered.filter((entry) => !hidden.has(entry.id));
    return savedOnly ? publicEntries.filter((entry) => savedIds.has(entry.id)) : publicEntries;
  }, [entries, goal, hiddenEntryIds, query, savedIds, savedOnly]);

  const visibleShelves = useMemo(
    () => groupDiscoveryEntriesByShelf(visibleEntries),
    [visibleEntries],
  );
  const activeEntryVisible = activePlayback
    ? visibleEntries.some((entry) => entry.id === activePlayback.id)
    : false;

  useEffect(() => {
    activePlaybackRef.current = activePlayback;
  }, [activePlayback]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const videos = [...videoRefs.current.values()];
    const visibilityByVideo = new Map(videos.map((video) => [video, 0]));

    const stopAmbientPreview = (video: HTMLVideoElement) => {
      if (video.dataset.discoveryPreview !== "ambient") return;
      video.pause();
      video.muted = true;
      delete video.dataset.discoveryPreview;
    };

    const refreshAmbientPreviews = () => {
      const previewVideos = activePlaybackRef.current?.playing
        ? new Set<HTMLVideoElement>()
        : new Set(
            videos
              .filter((video) => (
                (visibilityByVideo.get(video) || 0) >= ambientPreviewVisibilityThreshold
              ))
              .slice(0, maxAmbientVideoPreviews),
          );

      videos.forEach((video) => {
        if (!previewVideos.has(video)) {
          stopAmbientPreview(video);
          return;
        }
        if (!video.paused && video.dataset.discoveryPreview === "ambient") return;

        video.dataset.discoveryPreview = "ambient";
        video.muted = true;
        void video.play().catch((error) => {
          delete video.dataset.discoveryPreview;
          if (error instanceof DOMException && error.name === "AbortError") return;
          video.pause();
        });
      });
    };

    const observer = new IntersectionObserver((items) => {
      items.forEach((item) => {
        visibilityByVideo.set(
          item.target as HTMLVideoElement,
          item.isIntersecting ? item.intersectionRatio : 0,
        );
      });
      refreshAmbientPreviews();
    }, {
      threshold: [0, ambientPreviewVisibilityThreshold, 1],
    });

    videos.forEach((video) => observer.observe(video));
    return () => {
      observer.disconnect();
      videos.forEach(stopAmbientPreview);
    };
  }, [visibleEntries]);

  useEffect(() => {
    if (!activePlayback?.playing) return;
    const media = videoRefs.current.get(activePlayback.id) || audioRefs.current.get(activePlayback.id);
    const cardMedia = media?.closest(`.${styles.mediaWell}`);
    if (!media || !cardMedia) return;

    const observer = new IntersectionObserver(([item]) => {
      if (item?.isIntersecting && item.intersectionRatio >= 0.2) return;
      media.pause();
      media.muted = true;
      setActivePlayback((current) => playbackPaused(current, activePlayback.id));
    }, { threshold: [0, 0.2] });

    observer.observe(cardMedia);
    return () => observer.disconnect();
  }, [activePlayback?.id, activePlayback?.playing]);

  useEffect(() => {
    const stopHiddenMedia = () => {
      if (!document.hidden) return;
      videoRefs.current.forEach((video) => {
        video.pause();
        video.muted = true;
      });
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.muted = true;
      });
      setActivePlayback((current) => (
        current ? playbackPaused(current, current.id) : current
      ));
    };

    document.addEventListener("visibilitychange", stopHiddenMedia);
    return () => document.removeEventListener("visibilitychange", stopHiddenMedia);
  }, []);

  useEffect(() => {
    if (!activePlayback?.id || !activeEntryVisible) return;
    const media = videoRefs.current.get(activePlayback.id) || audioRefs.current.get(activePlayback.id);

    return () => {
      media?.pause();
      if (media) media.muted = true;
    };
  }, [activeEntryVisible, activePlayback?.id]);

  useEffect(() => {
    if (!activePlayback || activeEntryVisible) return;
    setActivePlayback(null);
  }, [activeEntryVisible, activePlayback]);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const toggleSave = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setToast("Removed from Saved ads");
      } else {
        next.add(id);
        setToast("Saved privately");
      }
      writeSavedDiscoveryIds(window.localStorage, next);
      return next;
    });
  };

  const mediaFor = (entry: DiscoveryEntry) => (
    videoRefs.current.get(entry.id) || audioRefs.current.get(entry.id)
  );

  const syncPlayback = (id: string, media: HTMLMediaElement) => {
    if (
      media instanceof HTMLVideoElement
      && media.dataset.discoveryPreview === "ambient"
      && media.muted
    ) return;
    if (media.paused) media.muted = true;
    setActivePlayback((current) => playbackSynced(current, id, media));
  };

  const stopErroredPlayback = (id: string, media: HTMLMediaElement) => {
    media.pause();
    media.muted = true;
    setActivePlayback((current) => playbackPaused(current, id));
  };

  const playWithSound = (entry: DiscoveryEntry) => {
    const media = mediaFor(entry);
    if (!media) return;

    if (media instanceof HTMLVideoElement) {
      delete media.dataset.discoveryPreview;
    }

    videoRefs.current.forEach((video, id) => {
      if (id === entry.id) return;
      video.pause();
      video.muted = true;
    });
    audioRefs.current.forEach((audio, id) => {
      if (id === entry.id) return;
      audio.pause();
      audio.muted = true;
    });

    if (activePlayback?.id !== entry.id) media.currentTime = 0;
    media.muted = false;
    setActivePlayback(playbackStarted(entry.id));
    void media.play().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      stopErroredPlayback(entry.id, media);
    });
  };

  const togglePlayback = (entry: DiscoveryEntry) => {
    if (entry.media.kind === "image") return;
    const media = mediaFor(entry);
    if (activePlayback?.id === entry.id && activePlayback.playing) {
      media?.pause();
      if (media) media.muted = true;
      setActivePlayback((current) => playbackPaused(current, entry.id));
      return;
    }
    playWithSound(entry);
  };

  const toggleSound = (entry: DiscoveryEntry) => {
    if (entry.media.kind === "image") return;
    const media = mediaFor(entry);
    if (!media || activePlayback?.id !== entry.id || !activePlayback.playing) return;
    const muted = !activePlayback.muted;
    media.muted = muted;
    setActivePlayback({ ...activePlayback, muted });
  };

  const hideEntry = async (entry: DiscoveryEntry) => {
    let accessToken = window.sessionStorage.getItem(ownerTokenStorageKey) || "";
    if (!accessToken) {
      accessToken = window.prompt("Enter your Wiggly owner key")?.trim() || "";
      if (!accessToken) return;
    }
    if (!window.confirm(`Hide "${entry.title}" from Discovery?`)) return;

    try {
      await hideDiscoveryEntry({ accessToken, entryId: entry.id });
      window.sessionStorage.setItem(ownerTokenStorageKey, accessToken);
      setToast("Hidden from Discovery");
    } catch {
      window.sessionStorage.removeItem(ownerTokenStorageKey);
      setToast("Owner key was not accepted");
    }
  };

  const shareEntry = async (entry: DiscoveryEntry) => {
    const url = `${window.location.origin}/formats/${entry.format.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${entry.format.name} Format`,
          text: `See the examples and run the ${entry.format.name} Format`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Ad link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setToast("Could not share this ad");
    }
  };

  const scrollShelf = (shelfId: string, direction: -1 | 1) => {
    const shelf = shelfRefs.current.get(shelfId);
    if (!shelf) return;
    shelf.scrollBy({
      left: direction * Math.max(280, shelf.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brandLink} aria-label="Wiggly home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wiggly-wordmark-3d-crop.png" alt="Wiggly" />
          </Link>

          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className={styles.srOnly}>Search finished ads</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ads, brands, Formats, creators"
            />
          </label>

          <div className={styles.headerActions}>
            <Link href="/submit" className={styles.headerButton}>
              Submit
            </Link>
            <Link
              href={savedOnly ? "/discover" : "/saved"}
              className={`${styles.headerButton} ${savedOnly ? styles.headerButtonActive : ""}`}
            >
              <Bookmark aria-hidden="true" />
              {savedOnly ? "Browse" : "Saved"} {savedIds.size > 0 ? `(${savedIds.size})` : ""}
            </Link>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Finished ads. Repeatable Formats.</p>
          <h1>{savedOnly ? "The ads you kept." : "npm for generative video."}</h1>
        </div>
        <div className={styles.heroCopy}>
          <strong>{savedOnly ? "Your private short list." : "See it. Trust it. Make yours."}</strong>
          <p>
            {savedOnly
              ? "Saved in this browser so you can come back to the work worth studying."
              : "Every finished ad points to the exact creative recipe behind it."}
          </p>
        </div>
      </section>

      <nav className={styles.filters} aria-label="Filter finished ads">
        {goalFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={goal === filter.id && !savedOnly ? styles.activeFilter : ""}
            aria-pressed={goal === filter.id && !savedOnly}
            onClick={() => setGoal(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      <section className={styles.feedBand} aria-labelledby="discovery-feed-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>{savedOnly ? "Private to you" : "Curated by Wiggly"}</p>
            <h2 id="discovery-feed-title">{savedOnly ? "Saved ads" : "Find your next format"}</h2>
          </div>
          <p>
            {savedOnly
              ? "The work you kept for later."
              : "Browse finished work by the kind of ad you want to make."}
          </p>
        </div>

        {visibleEntries.length > 0 ? (
          <div className={styles.shelves}>
            {visibleShelves.map((shelf) => (
              <section
                className={styles.shelf}
                key={shelf.id}
                aria-labelledby={`shelf-${shelf.id}`}
              >
                <div className={styles.shelfHeading}>
                  <div>
                    <h3 id={`shelf-${shelf.id}`}>{shelf.title}</h3>
                    <p>{shelf.description}</p>
                  </div>
                  <div className={styles.shelfControls}>
                    <span>
                      {shelf.entries.length} {shelf.entries.every((entry) => entry.role === "workflow-illustration")
                        ? (shelf.entries.length === 1 ? "authoring kit" : "authoring kits")
                        : (shelf.entries.length === 1 ? "ad" : "ads")}
                    </span>
                    <button
                      type="button"
                      onClick={() => scrollShelf(shelf.id, -1)}
                      aria-label={`Scroll ${shelf.title} left`}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollShelf(shelf.id, 1)}
                      aria-label={`Scroll ${shelf.title} right`}
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div
                  className={`${styles.shelfTrack} ${
                    shelf.layout === "landscape" ? styles.shelfTrackLandscape : ""
                  }`}
                  data-discovery-shelf-layout={shelf.layout}
                  ref={(track) => {
                    if (track) shelfRefs.current.set(shelf.id, track);
                    else shelfRefs.current.delete(shelf.id);
                  }}
                >
                  {shelf.entries.map((entry) => {
                    const saved = savedIds.has(entry.id);
                    const playing = activePlayback?.id === entry.id && activePlayback.playing;
                    const audible = playing && activePlayback?.muted === false;
                    const formatHref = `/formats/${entry.format.slug}`;

                    return (
                      <article className={styles.card} id={entry.id} key={entry.id}>
                        <div
                          className={`${styles.mediaWell} ${
                            entry.media.aspectRatio === "16:9"
                              ? styles.mediaWellLandscape
                              : entry.media.aspectRatio === "3:4"
                              ? styles.mediaWellThreeFour
                              : entry.media.kind === "image" || entry.format.slug === "brainrot"
                              ? styles.mediaWellImage
                              : ""
                          }`}
                        >
                          <Link
                            href={formatHref}
                            className={styles.mediaLink}
                            aria-label={`Open ${entry.format.name} format`}
                          >
                            {entry.media.kind === "video" ? (
                              <video
                                ref={(video) => {
                                  if (video) videoRefs.current.set(entry.id, video);
                                  else videoRefs.current.delete(entry.id);
                                }}
                                data-discovery-video={entry.id}
                                src={entry.media.src}
                                poster={entry.media.poster}
                                muted
                                loop
                                playsInline
                                preload="none"
                                onPlay={(event) => syncPlayback(entry.id, event.currentTarget)}
                                onPause={(event) => syncPlayback(entry.id, event.currentTarget)}
                                onError={(event) => stopErroredPlayback(entry.id, event.currentTarget)}
                              />
                            ) : entry.media.kind === "audio" ? (
                              <>
                                <DiscoveryAudioArtwork entry={entry} playing={playing} />
                                <audio
                                  ref={(audio) => {
                                    if (audio) audioRefs.current.set(entry.id, audio);
                                    else audioRefs.current.delete(entry.id);
                                  }}
                                  src={entry.media.src}
                                  preload="none"
                                  loop
                                  onPlay={(event) => syncPlayback(entry.id, event.currentTarget)}
                                  onPause={(event) => syncPlayback(entry.id, event.currentTarget)}
                                  onError={(event) => stopErroredPlayback(entry.id, event.currentTarget)}
                                />
                              </>
                            ) : (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={entry.media.src} alt={`${entry.brand}: ${entry.title}`} />
                                <DiscoveryReferenceInset entry={entry} variant="card" />
                              </>
                            )}

                            <span className={styles.formatTag}>{entry.format.name}</span>
                            <span className={styles.runtime}>{entry.media.durationLabel}</span>
                          </Link>

                          {entry.media.kind !== "image" ? (
                            <div className={styles.mediaControls}>
                              <button
                                type="button"
                                onClick={() => togglePlayback(entry)}
                                aria-label={playing ? `Pause ${entry.title}` : `Play ${entry.title} with sound`}
                                title={playing ? "Pause" : "Play with sound"}
                              >
                                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                              </button>
                              {playing ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSound(entry)}
                                  aria-label={audible ? `Mute ${entry.title}` : `Unmute ${entry.title}`}
                                  title={audible ? "Mute" : "Unmute"}
                                >
                                  {audible ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {curationMode ? (
                            <button
                              type="button"
                              className={styles.curationButton}
                              onClick={() => void hideEntry(entry)}
                              aria-label={`Hide ${entry.title} from Discovery`}
                              title="Hide from Discovery"
                            >
                              <X aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>

                        <div className={styles.cardCopy}>
                          <h3>{entry.format.name}</h3>
                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              className={saved ? styles.savedButton : ""}
                              onClick={() => toggleSave(entry.id)}
                            >
                              <Bookmark aria-hidden="true" />
                              {saved ? "Saved" : "Save"}
                            </button>
                            <button type="button" onClick={() => void shareEntry(entry)}>
                              <Share2 aria-hidden="true" />
                              Share
                            </button>
                            <Link href={formatHref}>
                              Open format
                              <ExternalLink aria-hidden="true" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.kicker}>{savedOnly ? "Nothing saved yet" : "No exact match yet"}</p>
            <h2>{savedOnly ? "Keep the ads you want to study." : "Try another goal or search."}</h2>
            <Link href="/discover">
              Browse all finished ads
            </Link>
          </div>
        )}
      </section>

      <div className={`${styles.toast} ${toast ? styles.toastVisible : ""}`} role="status">
        {toast}
      </div>
    </main>
  );
}
