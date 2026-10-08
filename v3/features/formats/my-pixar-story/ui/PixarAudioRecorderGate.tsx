"use client";

import React, { useState, useEffect } from "react";
import { Mic, Square, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PixarAudioRecorderGateProps {
  onAudioReady: (audioUrl: string, durationSeconds: number) => void;
  className?: string;
}

export function PixarAudioRecorderGate({
  onAudioReady,
  className = "",
}: PixarAudioRecorderGateProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = () => {
    setElapsedSeconds(0);
    setRecordedAudioUrl(null);
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    const mockBlobUrl = `https://assets.wiggly.internal/recordings/parent-voice-${Date.now()}.mp3`;
    setRecordedAudioUrl(mockBlobUrl);

    if (elapsedSeconds >= 10) {
      onAudioReady(mockBlobUrl, elapsedSeconds);
    }
  };

  const gateMet = elapsedSeconds >= 10;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / 10) * 100));

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">
            Voice Clone Gate (10-Second Minimum)
          </h4>
          <p className="text-xs text-slate-400">
            Speak naturally about your favorite childhood memory. Cartesia Sonic cloning requires at least 10 seconds of clear speech.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            gateMet
              ? "border-emerald-500/50 text-emerald-400"
              : "border-amber-500/50 text-amber-400"
          }
        >
          {gateMet ? "GATE PASSED (10s+)" : `${elapsedSeconds}/10s REQUIRED`}
        </Badge>
      </div>

      <div className="pt-4 space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              gateMet ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Recorder Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <Button
                type="button"
                onClick={startRecording}
                variant="outline"
                className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <Mic className="size-4 animate-pulse" />
                {recordedAudioUrl ? "Record Again" : "Start 10s Voice Sample"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={stopRecording}
                variant="destructive"
                className="gap-2"
              >
                <Square className="size-4" />
                Finish Recording ({elapsedSeconds}s)
              </Button>
            )}

            {isRecording && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>

          <div>
            {gateMet ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle className="size-4" />
                Speech verified ({elapsedSeconds}s)
              </div>
            ) : recordedAudioUrl ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <AlertCircle className="size-4" />
                Only {elapsedSeconds}s recorded. Please speak for at least 10s.
              </div>
            ) : (
              <span className="text-xs text-slate-500">Click to record voice sample</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
