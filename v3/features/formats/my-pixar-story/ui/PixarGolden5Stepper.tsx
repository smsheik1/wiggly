"use client";

import React, { useState } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Golden5Answers, StoryBeatNumber } from "../types";

export interface PixarGolden5StepperProps {
  answers: Golden5Answers;
  onChange: (updatedAnswers: Golden5Answers) => void;
  className?: string;
}

interface StepDefinition {
  beatNumber: StoryBeatNumber;
  title: string;
  ageLabel: string;
  prompt: string;
  fieldA: {
    key: string;
    label: string;
    placeholder: string;
  };
  fieldB: {
    key: string;
    label: string;
    placeholder: string;
  };
  fieldC?: {
    key: string;
    label: string;
    placeholder: string;
  };
  buckets: string[];
}

const STEPS: StepDefinition[] = [
  {
    beatNumber: 1,
    title: "The Kid",
    ageLabel: "Ages 7–10",
    prompt:
      "Take us back to you at 8 years old: who was your partner-in-crime, what silly trouble did you get into, and what was your weird obsession that you thought was the coolest thing on earth?",
    fieldA: {
      key: "partnerInCrime",
      label: "Partner-in-Crime",
      placeholder: "e.g. My mischievous golden retriever Rusty",
    },
    fieldB: {
      key: "weirdObsession",
      label: "Weird Obsession",
      placeholder: "e.g. Drawing elaborate superhero blueprints in my spiral notebook",
    },
    fieldC: {
      key: "sillyTrouble",
      label: "Silly Trouble",
      placeholder: "e.g. Launching baking soda rockets into Mrs. Gable's petunia bed",
    },
    buckets: ["Outdoor Explorer", "Lego/Fort Builder", "Comic/Dino Fanatic", "Neighborhood Prankster"],
  },
  {
    beatNumber: 2,
    title: "The Teen",
    ageLabel: "Ages 15–18",
    prompt:
      "What was your first real taste of freedom—what were you driving or riding, and what is one thing about teenage you that would shock your kids?",
    fieldA: {
      key: "freedomMachine",
      label: "Freedom Machine",
      placeholder: "e.g. A rattle-trap sky blue 1974 Volkswagen Beetle",
    },
    fieldB: {
      key: "secretTeenIdentity",
      label: "Secret Teen Identity",
      placeholder: "e.g. Drumming in a terribly loud garage rock band called The Sparks",
    },
    buckets: ["First Beat-up Car", "BMX / Skateboard", "Garage Band Rocker", "Secret Athlete / Artist"],
  },
  {
    beatNumber: 3,
    title: "The Leap of Faith",
    ageLabel: "Ages 19–25",
    prompt:
      "What was the craziest risk or adventure you took when you first stepped out on your own, and the moment you realized 'I actually did it'?",
    fieldA: {
      key: "riskOrAdventure",
      label: "The Big Risk",
      placeholder: "e.g. Moving across the country with two suitcases and sixty dollars to open my clock workshop",
    },
    fieldB: {
      key: "triumphMoment",
      label: "Moment of Triumph",
      placeholder: "e.g. The day the town square church bell chimed after I spent all night fixing its gears",
    },
    buckets: ["Moving with Two Bags", "Scrappy First Job", "Starting a Business", "Solo Trip"],
  },
  {
    beatNumber: 4,
    title: "The Romance",
    ageLabel: "Origin of Us",
    prompt:
      "How did you meet Mom/Dad/Spouse, what was the most awkward or hilarious moment trying to impress them, and when did you know they were the one?",
    fieldA: {
      key: "howWeMet",
      label: "How We Met",
      placeholder: "e.g. We both reached for the very same vintage jazz record at Murray's Music Shop",
    },
    fieldB: {
      key: "awkwardDateMoment",
      label: "Awkward Date Moment",
      placeholder: "e.g. Dropping my ice cream cone straight onto my shoes on our first boardwalk walk",
    },
    fieldC: {
      key: "theMomentIKnew",
      label: "The Moment I Knew",
      placeholder: "e.g. When she laughed until tears came out and offered me half her cone",
    },
    buckets: ["Sweethearts", "Workplace Encounter", "Clumsy First Date", "Blind Date Setup"],
  },
  {
    beatNumber: 5,
    title: "The Legacy Hug",
    ageLabel: "The Finale",
    prompt:
      "What is one thing you wish your kids truly understood about who you are inside—and if you could give your 8-year-old self a hug today, what would you say?",
    fieldA: {
      key: "whatIWishKidsUnderstood",
      label: "What I Wish They Understood",
      placeholder: "e.g. Every gray hair was earned having the absolute time of my life with your mother and you kids",
    },
    fieldB: {
      key: "timeMachineMessageToChildSelf",
      label: "Message to 8-Year-Old Self",
      placeholder: "e.g. Don't hurry growing up so fast little buddy, the quiet ordinary days are the magical ones",
    },
    buckets: ["The Quiet Days Matter", "Don't Be Afraid of Failing", "Family First", "Live Boldly"],
  },
];

export function PixarGolden5Stepper({
  answers,
  onChange,
  className = "",
}: PixarGolden5StepperProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const currentStep = STEPS[activeStepIndex]!;

  const getAnswerSection = (index: number) => {
    switch (index) {
      case 0:
        return answers.scene1Childhood;
      case 1:
        return answers.scene2TeenFreedom;
      case 2:
        return answers.scene3LeapOfFaith;
      case 3:
        return answers.scene4Romance;
      case 4:
        return answers.scene5LegacyFinale;
      default:
        return answers.scene1Childhood;
    }
  };

  const updateCurrentField = (fieldKey: string, value: string) => {
    switch (activeStepIndex) {
      case 0:
        onChange({
          ...answers,
          scene1Childhood: { ...answers.scene1Childhood, [fieldKey]: value },
        });
        break;
      case 1:
        onChange({
          ...answers,
          scene2TeenFreedom: { ...answers.scene2TeenFreedom, [fieldKey]: value },
        });
        break;
      case 2:
        onChange({
          ...answers,
          scene3LeapOfFaith: { ...answers.scene3LeapOfFaith, [fieldKey]: value },
        });
        break;
      case 3:
        onChange({
          ...answers,
          scene4Romance: { ...answers.scene4Romance, [fieldKey]: value },
        });
        break;
      case 4:
        onChange({
          ...answers,
          scene5LegacyFinale: { ...answers.scene5LegacyFinale, [fieldKey]: value },
        });
        break;
    }
  };

  const currentValues = getAnswerSection(activeStepIndex) as Record<string, string>;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* 5-Step Progress Rail */}
      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((s, idx) => {
          const isActive = idx === activeStepIndex;
          const isDone = idx < activeStepIndex;

          return (
            <button
              key={s.beatNumber}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`flex flex-col items-center p-2.5 rounded-xl border transition-all text-center ${
                isActive
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-300 shadow-md"
                  : isDone
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                {isDone ? <Check className="size-3 text-emerald-400" /> : null}
                Scene {s.beatNumber}
              </div>
              <div className="text-xs font-medium truncate max-w-full mt-0.5">{s.title}</div>
              <div className="text-[10px] text-slate-400">{s.ageLabel}</div>
            </button>
          );
        })}
      </div>

      {/* Active Step Intake Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md space-y-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-3.5" />
            Chapter {currentStep.beatNumber}: {currentStep.title} ({currentStep.ageLabel})
          </div>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{currentStep.prompt}</p>
        </div>

        {/* Idea Buckets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {currentStep.buckets.map((b) => (
            <Badge
              key={b}
              variant="outline"
              className="text-[10px] bg-slate-800/60 border-slate-700 text-slate-300"
            >
              {b}
            </Badge>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-300">{currentStep.fieldA.label}</Label>
            <Textarea
              rows={2}
              value={currentValues[currentStep.fieldA.key] || ""}
              onChange={(e) => updateCurrentField(currentStep.fieldA.key, e.target.value)}
              placeholder={currentStep.fieldA.placeholder}
              className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-300">{currentStep.fieldB.label}</Label>
            <Textarea
              rows={2}
              value={currentValues[currentStep.fieldB.key] || ""}
              onChange={(e) => updateCurrentField(currentStep.fieldB.key, e.target.value)}
              placeholder={currentStep.fieldB.placeholder}
              className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs"
            />
          </div>

          {(() => {
            const fieldC = currentStep.fieldC;
            if (!fieldC) return null;
            return (
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">{fieldC.label}</Label>
                <Textarea
                  rows={2}
                  value={currentValues[fieldC.key] || ""}
                  onChange={(e) => updateCurrentField(fieldC.key, e.target.value)}
                  placeholder={fieldC.placeholder}
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs"
                />
              </div>
            );
          })()}
        </div>

        {/* Stepper Navigation */}
        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
            className="text-xs text-slate-400"
          >
            Previous Chapter
          </Button>

          {activeStepIndex < STEPS.length - 1 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))}
              className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              Next Chapter
              <ChevronRight className="size-3.5" />
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/40">
              All 5 Chapters Complete
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
