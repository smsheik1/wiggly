"use client";

import React, { useState } from "react";
import { Sparkles, Film, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PixarCharacterMirrorCard } from "./PixarCharacterMirrorCard";
import { PixarAudioRecorderGate } from "./PixarAudioRecorderGate";
import { PixarGolden5Stepper } from "./PixarGolden5Stepper";
import { compileStoryboard } from "../screenplay";
import { createMyPixarStoryScene } from "../../../scene/createMyPixarStoryScene";
import { validateMyPixarStoryInputs } from "../validate";
import type {
  MyPixarStoryInputs,
  ConfirmedPhysicalTraits,
  Golden5Answers,
} from "../types";
import type { MyPixarStoryAdScene } from "@/features/scene/types";

export interface CreatePixarStorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSceneCreated: (scene: MyPixarStoryAdScene) => void;
}

export interface PixarStoryIntakeFormProps {
  onSceneCreated: (scene: MyPixarStoryAdScene) => void;
  onCancel?: () => void;
  className?: string;
}

const DEFAULT_TRAITS: ConfirmedPhysicalTraits = {
  gender: "male",
  ageBracket: "60s",
  hairColor: "grey",
  hairStyle: "short",
  eyeColor: "brown",
  glasses: true,
  facialHair: "none",
  signatureTraits: ["kind smile", "crinkles around eyes"],
};

const DEFAULT_ANSWERS: Golden5Answers = {
  scene1Childhood: {
    partnerInCrime: "my golden retriever Buster",
    sillyTrouble: "building treehouses that tipped over into Mrs. Higgins' tomatoes",
    weirdObsession: "sketching comic books on old paper grocery bags",
  },
  scene2TeenFreedom: {
    freedomMachine: "a beat-up 1978 Chevy Malibu",
    secretTeenIdentity: "drumming in a terribly loud garage rock band",
  },
  scene3LeapOfFaith: {
    riskOrAdventure: "moving across the state with one backpack to start my carpentry shop",
    triumphMoment: "the day my first handcrafted dining table was delivered",
  },
  scene4Romance: {
    howWeMet: "we both reached for the exact same apple at the farmers market",
    awkwardDateMoment: "tripping over my own shoelaces on the boardwalk",
    theMomentIKnew: "when she laughed warmly and offered me her spare handkerchief",
  },
  scene5LegacyFinale: {
    whatIWishKidsUnderstood: "every gray hair was earned loving every second of watching you grow up",
    timeMachineMessageToChildSelf: "don't be afraid to take chances, the ordinary moments are where the gold is",
  },
};

export function PixarStoryIntakeForm({
  onSceneCreated,
  onCancel,
  className = "",
}: PixarStoryIntakeFormProps) {
  const [subjectName, setSubjectName] = useState("Artie");
  const [recipientName, setRecipientName] = useState("Lily");
  const [relationship, setRelationship] = useState<"father" | "mother" | "grandparent">("grandparent");
  const [traits, setTraits] = useState<ConfirmedPhysicalTraits>(DEFAULT_TRAITS);
  const [answers, setAnswers] = useState<Golden5Answers>(DEFAULT_ANSWERS);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleBuildScene = () => {
    setValidationError(null);

    const inputs: MyPixarStoryInputs = {
      subject: {
        fullName: subjectName,
        preferredName: subjectName,
        recipientName,
        relationshipToRecipient: relationship,
        referencePhotoUrls: [],
        gender: traits.gender,
        keyPhysicalTraits: traits,
      },
      answers,
      audio: {
        narrationMode: "parent_clone",
        voiceCapture: audioUrl
          ? {
              source: "browser_record",
              audioUrl,
              durationSeconds: audioDuration,
            }
          : undefined,
      },
      tone: "heartwarming_tearjerker",
    };

    const validation = validateMyPixarStoryInputs(inputs);
    if (!validation.valid) {
      setValidationError(validation.errors.join("; "));
      return;
    }

    const storyboard = compileStoryboard(inputs);
    const scene = createMyPixarStoryScene({
      storyboard,
      voiceoverAudioUrl: audioUrl || undefined,
    });

    onSceneCreated(scene);
    if (onCancel) onCancel();
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 ${className}`}>
      <div className="p-6 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold gap-1">
            <Sparkles className="size-3" />
            My Pixar Story
          </Badge>
          <span className="text-xs text-slate-400">5 Chapters • 3D Animated Memoir</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight mt-1">
          Create Your 3D Family Memoir
        </h2>
        <p className="text-xs text-slate-400">
          Tell your life story across 5 chapters to your child or grandchild. Rendered into a
          warm, Pixar-style prologue animation.
        </p>
      </div>

      <ScrollArea className="flex-1 p-6 space-y-6">
        <div className="space-y-6 pb-8">
          {/* Section 1: Names & Dedication */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              1. Subject & Dedication
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Your Name (Parent/Grandparent)</Label>
                <Input
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Artie"
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Dedicate To (Child/Grandchild)</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Lily"
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 4-Tap Character Mirror */}
          <div className="space-y-2">
            <PixarCharacterMirrorCard traits={traits} onChange={setTraits} />
          </div>

          {/* Section 3: 10-Second Voice Capture Gate */}
          <div className="space-y-2">
            <PixarAudioRecorderGate
              onAudioReady={(url, duration) => {
                setAudioUrl(url);
                setAudioDuration(duration);
              }}
            />
          </div>

          {/* Section 4: Golden 5 Chapters */}
          <div className="space-y-2">
            <PixarGolden5Stepper answers={answers} onChange={setAnswers} />
          </div>

          {validationError && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
              {validationError}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-5 border-t border-white/10 bg-slate-900/80 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          1 Question = 1 Story Beat = 1 Rendered Scene
        </div>
        <Button
          type="button"
          onClick={handleBuildScene}
          className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold px-6 shadow-lg shadow-amber-500/20"
        >
          <Film className="size-4" />
          Build 5-Chapter Pixar Cut
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function CreatePixarStorySheet({
  open,
  onOpenChange,
  onSceneCreated,
}: CreatePixarStorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-slate-950 border-slate-800 text-slate-100 p-0 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Create Your 3D Family Memoir</SheetTitle>
          <SheetDescription>5 Chapters Pixar-style memoir</SheetDescription>
        </SheetHeader>
        <PixarStoryIntakeForm
          onSceneCreated={onSceneCreated}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
