/**
 * My Pixar Story — Types & Data Contracts
 *
 * Golden Rule: 1 Question = 1 Story Beat = 1 Rendered Scene.
 * Total video length: 5 scenes, ~60–75 seconds.
 */

export type StoryBeatNumber = 1 | 2 | 3 | 4 | 5;

export type HairColor = 'dark_brown' | 'black' | 'blonde' | 'red' | 'grey' | 'white' | 'bald';
export type HairStyle = 'short' | 'wavy' | 'curly' | 'long' | 'buzz' | 'receding';
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel';
export type GlassesStyle = 'none' | 'wireframe' | 'bold_dark';
export type FacialHairStyle = 'none' | 'stubble' | 'short_beard' | 'full_beard' | 'mustache';

export interface ConfirmedPhysicalTraits {
  gender: 'male' | 'female' | 'non-binary';
  ageBracket: '30s' | '40s' | '50s' | '60s' | '70s+';
  hairColor: HairColor | string;
  hairStyle: HairStyle | string;
  eyeColor: EyeColor | string;
  glasses: boolean | GlassesStyle;
  facialHair?: FacialHairStyle | string;
  skinTone?: string;
  signatureTraits?: string[]; // e.g., ["round wireframe spectacles", "lean angular jawline"]
}

export interface CharacterVisualProfile {
  status: 'pending_upload' | 'detected' | 'confirmed';
  sourcePhotoUrls: string[];
  confirmedTraits: ConfirmedPhysicalTraits;
  compiledCharacterDnaPrompt: string;
}

export interface Golden5Answers {
  // Scene 1: The Kid (Ages 7–10)
  scene1Childhood: {
    partnerInCrime: string;
    sillyTrouble: string;
    weirdObsession: string;
  };
  // Scene 2: The Teen (Ages 15–18)
  scene2TeenFreedom: {
    freedomMachine: string; // e.g. "1992 Honda Civic" or "BMX bike"
    secretTeenIdentity: string; // e.g. "I was in a grunge rock band"
  };
  // Scene 3: The Leap of Faith (Ages 19–25)
  scene3LeapOfFaith: {
    riskOrAdventure: string;
    triumphMoment: string;
  };
  // Scene 4: Mom & Dad Romance Origin
  scene4Romance: {
    howWeMet: string;
    awkwardDateMoment: string;
    theMomentIKnew: string;
  };
  // Scene 5: Legacy & Time-Machine Hug (Finale)
  scene5LegacyFinale: {
    whatIWishKidsUnderstood: string;
    timeMachineMessageToChildSelf: string;
  };
}

export interface VoiceCaptureConfig {
  source: 'upload' | 'browser_record';
  audioUrl: string;
  durationSeconds: number; // minimum 10 seconds required
}

export interface MyPixarStoryInputs {
  subject: {
    fullName: string;
    preferredName: string;
    recipientName: string; // e.g., "Lisa", "Hailie"
    relationshipToRecipient: 'father' | 'mother' | 'grandparent';
    referencePhotoUrls: string[];
    gender: 'male' | 'female' | 'non-binary';
    keyPhysicalTraits: ConfirmedPhysicalTraits;
  };
  answers: Golden5Answers;
  audio: {
    narrationMode: 'parent_clone' | 'storybook_narrator';
    voiceCapture?: VoiceCaptureConfig;
    preferredStorybookVoice?: 'warm_morgan_freeman' | 'warm_pixar_maternal' | 'warm_pixar_paternal';
  };
  tone: 'heartwarming_tearjerker' | 'playful_adventure' | 'triumphant_inspirational';
  visuals?: {
    imageProvider?: 'meta-muse' | 'replicate';
    imageModel?: string;
  };
  familyMemorabilia?: FamilyScrapbookArtifact[];
}

export type ScrapbookArtifactType = 'photo' | 'handwritten_note' | 'ticket' | 'keepsake' | 'diploma';
export type ScrapbookPlacement = 'background_shelf' | 'corkboard' | 'photo_frame' | 'refrigerator_magnet' | 'scrapbook_corner';

export interface FamilyScrapbookArtifact {
  id: string;
  beatNumber: StoryBeatNumber;
  artifactType: ScrapbookArtifactType;
  assetUrl: string;
  description: string;
  placementInScene: ScrapbookPlacement;
  caption?: string;
}

export type PixarSceneMood =
  | 'whimsical_wonder'
  | 'youthful_energy'
  | 'melancholic_grit'
  | 'warm_romantic_glow'
  | 'emotional_tearjerker';

export type ShotScale =
  | 'wide_establishing'
  | 'medium_story'
  | 'medium_close'
  | 'intimate_close_up';

export type FocalLength = '24mm' | '35mm' | '50mm' | '65mm' | '85mm';

export interface CinematicShot {
  shotType: 'shot_a_establishing' | 'shot_b_reaction';
  name: string;
  description: string;
  keyframePrompt: string;
  videoPrompt: string;
  durationSeconds: number; // 10s
}

export interface MyPixarStoryScene {
  sceneIndex: 0 | 1 | 2 | 3 | 4;
  beatNumber: StoryBeatNumber;
  beatTitle: string;
  ageLabel: string; // e.g., "Age 8", "Age 16", "Age 22", "Age 28", "Present Day"
  narrationScript: string;
  estimatedDurationSeconds: number;
  
  // Prompts for visual generation
  characterDnaAgePrompt: string;
  keyframeImagePrompt: string;
  seaDanceVideoPrompt: string;
  
  // 2-Shot Cinematic System (Shot A Establishing + Shot B Reaction)
  shotA?: CinematicShot;
  shotB?: CinematicShot;

  // Direction & Cinematography (Accordion Camera System)
  shotScale: ShotScale;
  focalLength: FocalLength;
  musicMood: PixarSceneMood;
  cameraMovement: string;
  environmentalLighting: string;

  // v2 Realism & Scrapbook Memorabilia
  scrapbookArtifact?: FamilyScrapbookArtifact;
}

export interface MyPixarStoryStoryboard {
  format: 'my-pixar-story';
  version: '0.1.0';
  subjectName: string;
  recipientName: string;
  compiledCharacterDna: string;
  tone: MyPixarStoryInputs['tone'];
  familyMemorabilia?: FamilyScrapbookArtifact[];
  imageProvider?: 'meta-muse' | 'replicate';
  imageModel?: string;
  scenes: [
    MyPixarStoryScene,
    MyPixarStoryScene,
    MyPixarStoryScene,
    MyPixarStoryScene,
    MyPixarStoryScene
  ];
  totalDurationSeconds: number;
  narrationAudioUrl?: string;
  musicTrackId: string;
}

// Orchestrator State Machine Interfaces
export type SlotStatus = 'unseen' | 'in_progress' | 'filled' | 'confirmed';

export interface NarrativeSlot {
  id: keyof Golden5Answers;
  beat: StoryBeatNumber;
  title: string;
  questionPrompt: string;
  status: SlotStatus;
  userRawTranscript?: string;
  distilledAnswer?: string;
  selectedBucket?: string;
  emotionalKeywords?: string[];
}

export interface TangentMemory {
  id: string;
  timestamp: string;
  content: string;
  possibleBeatRelevance: StoryBeatNumber;
}

export interface SessionCheckpoint {
  checkpointId: string;
  timestamp: string;
  pipelineStage: string;
  currentActiveSlotId: string;
  completedSlotsCount: number;
}

export interface InterviewSessionState {
  sessionId: string;
  userId: string;
  subjectName: string;
  recipientName: string;
  createdAt: string;
  updatedAt: string;
  
  pipelineStage:
    | 'visual_profile_onboarding'
    | 'audio_capture'
    | 'golden_5_interview'
    | 'script_review'
    | 'draft_preview_rendering'
    | 'draft_preview_ready'
    | 'final_export_rendering'
    | 'completed';
    
  visualProfile: CharacterVisualProfile;
  audioCapture: {
    status: 'pending' | 'recorded' | 'uploaded' | 'verified';
    durationSeconds: number;
    audioFileUrl?: string;
    narrationMode: 'parent_clone' | 'storybook_narrator';
  };
  currentActiveSlotId: keyof Golden5Answers;
  slots: Record<keyof Golden5Answers, NarrativeSlot>;
  anecdoteBank: TangentMemory[];
  checkpoints: SessionCheckpoint[];
}

export type { MyPixarStoryAdScene, MyPixarStoryAdSceneLayout } from "../../scene/types";
