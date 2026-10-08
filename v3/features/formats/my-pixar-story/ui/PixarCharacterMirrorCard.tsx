"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ConfirmedPhysicalTraits, HairColor, EyeColor, GlassesStyle, FacialHairStyle } from "../types";

export interface PixarCharacterMirrorCardProps {
  traits: ConfirmedPhysicalTraits;
  onChange: (updatedTraits: ConfirmedPhysicalTraits) => void;
  className?: string;
}

const HAIR_COLORS: Array<{ id: HairColor; label: string }> = [
  { id: "dark_brown", label: "Dark Brown" },
  { id: "black", label: "Black" },
  { id: "blonde", label: "Blonde" },
  { id: "red", label: "Auburn / Red" },
  { id: "grey", label: "Silver / Grey" },
  { id: "white", label: "White" },
  { id: "bald", label: "Bald / Shaved" },
];

const EYE_COLORS: Array<{ id: EyeColor; label: string }> = [
  { id: "brown", label: "Brown" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "hazel", label: "Hazel" },
];

const GLASSES_STYLES: Array<{ id: GlassesStyle; label: string }> = [
  { id: "none", label: "No Glasses" },
  { id: "wireframe", label: "Round Wireframe" },
  { id: "bold_dark", label: "Dark Modern Frames" },
];

const FACIAL_HAIR_STYLES: Array<{ id: FacialHairStyle; label: string }> = [
  { id: "none", label: "Clean Shaven" },
  { id: "stubble", label: "Subtle Stubble" },
  { id: "short_beard", label: "Trimmed Beard" },
  { id: "full_beard", label: "Full Beard" },
  { id: "mustache", label: "Signature Mustache" },
];

export function PixarCharacterMirrorCard({
  traits,
  onChange,
  className = "",
}: PixarCharacterMirrorCardProps) {
  const updateTrait = <K extends keyof ConfirmedPhysicalTraits>(
    key: K,
    value: ConfirmedPhysicalTraits[K]
  ) => {
    onChange({
      ...traits,
      [key]: value,
    });
  };

  return (
    <div
      className={`rounded-2xl border border-amber-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-amber-300 uppercase">
            4-Tap Character Mirror
          </h3>
          <p className="text-xs text-slate-400">
            Confirm physical traits to guarantee Pixar 3D DNA continuity across all 5 chapters.
          </p>
        </div>
        <Badge variant="outline" className="border-amber-400/40 text-amber-300 font-mono text-[10px]">
          DNA LOCKED
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {/* Hair Color */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">1. Hair Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {HAIR_COLORS.map(({ id, label }) => {
              const active = traits.hairColor === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateTrait("hairColor", id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    active
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Eye Color */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">2. Eye Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {EYE_COLORS.map(({ id, label }) => {
              const active = traits.eyeColor === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateTrait("eyeColor", id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    active
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Glasses */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">3. Eyewear</Label>
          <div className="flex flex-wrap gap-1.5">
            {GLASSES_STYLES.map(({ id, label }) => {
              const active =
                id === "none"
                  ? traits.glasses === false || traits.glasses === "none"
                  : traits.glasses === id || (traits.glasses === true && id === "wireframe");
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateTrait("glasses", id === "none" ? false : id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    active
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Facial Hair */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">4. Facial Hair</Label>
          <div className="flex flex-wrap gap-1.5">
            {FACIAL_HAIR_STYLES.map(({ id, label }) => {
              const active = (traits.facialHair || "none") === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateTrait("facialHair", id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    active
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
