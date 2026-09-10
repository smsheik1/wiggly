export type DiscoveryGoal = "all" | "sell" | "explain" | "story" | "teach" | "entertain";

export type DiscoveryEntry = {
  id: string;
  status: "published" | "draft";
  showInDiscovery?: boolean;
  order: number;
  brand: string;
  title: string;
  curatorNote: string;
  role?: "workflow-illustration";
  goal: Exclude<DiscoveryGoal, "all">;
  media: {
    kind: "video" | "image" | "audio";
    src: string;
    poster?: string;
    referenceSrc?: string;
    durationLabel: string;
    accentColor?: string;
    aspectRatio?: "9:16" | "16:9" | "3:4";
  };
  format: {
    slug: string;
    name: string;
    version: string;
    owner: string;
  };
};

export type DiscoveryShelfLayout = "portrait" | "landscape";

export type DiscoveryFormatProfile = {
  slug: string;
  name: string;
  version: string;
  creator: string;
  promise: string;
  lastUpdated: string;
  technicalHref?: string;
  repositoryHref?: string;
  githubRepo?: string;
  packagePath?: string;
  proofEntries: DiscoveryEntry[];
  whatStays: string[];
  whatChanges: string[];
  characterOptions?: DiscoveryCharacterOption[];
  handoff?: DiscoveryFormatHandoff;
};

export type DiscoveryCharacterOption = {
  id: string;
  name: string;
  personality: string;
  portraitSrc: string;
  modelSrc?: string;
  audioSrc: string;
  previewLine: string;
  accentColor: string;
};

export type DiscoveryRunEstimate = {
  label: string;
  cost: string;
  time: string;
};

export type DiscoveryFormatHandoff = {
  requiredInputs: string[];
  deliverables: string[];
  instructions: string[];
  estimates: DiscoveryRunEstimate[];
  totalEstimate: string;
  output: string;
  firstQuestion: string;
};

export type DiscoveryCreator = {
  handle: string;
  name: string;
  bio: string;
  avatar: {
    kind: "image" | "initials";
    value: string;
  };
};
