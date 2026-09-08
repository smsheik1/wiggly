import { discoveryShelfDefinitions } from "./catalog";
import type { AnimalConversationsTrustData } from "./animalConversationsTrust.server";
import { getAnimalConversationsTrustData } from "./animalConversationsTrust.server";
import type { BikiniBottomDanceOffTrustData } from "./bikiniBottomDanceOffTrust.server";
import { getBikiniBottomDanceOffTrustData } from "./bikiniBottomDanceOffTrust.server";
import type { ShazPuppetRuntimeTrustData } from "./shazPuppetRuntimeTrust.server";
import { getShazPuppetRuntimeTrustData } from "./shazPuppetRuntimeTrust.server";
import { getDiscoveryFormatProfile } from "./formatProof.server";
import {
  getFormatRepoPackageData,
  type FormatRepoPackageData,
} from "./formatRepoPackage.server";

type RepoPageCopy = {
  runDescription: string;
  examplesTitle: string;
  examplesDescription?: string;
};

export type FormatRepoPagePresentation =
  | {
      kind: "shared";
      package: FormatRepoPackageData | null;
      copy: RepoPageCopy;
      detailedProofId?: undefined;
    }
  | {
      kind: "bikini-bottom-dance-off";
      trust: BikiniBottomDanceOffTrustData;
      copy: RepoPageCopy;
      detailedProofId: string;
    }
  | {
      kind: "animal-conversations";
      trust: AnimalConversationsTrustData;
      copy: RepoPageCopy;
      detailedProofId?: undefined;
    }
  | {
      kind: "shaz-puppet-runtime";
      trust: ShazPuppetRuntimeTrustData;
      copy: RepoPageCopy;
      detailedProofId: "shaz-puppet-runtime-talking-scene";
    };

export const richFormatRepoSlugs = [
  "bikini-bottom-dance-off",
  "animal-conversations",
  "shaz-puppet-runtime",
] as const;

export function getFormatRepoFamily(slug: string) {
  const family = discoveryShelfDefinitions.find(
    (candidate) => candidate.id === "skai-generated",
  );
  if (!family?.formats.some((candidate) => candidate === slug)) {
    return null;
  }

  return {
    name: family.title,
    formatCount: family.formats.length,
    discoveryHref: "/discover#shelf-skai-generated",
  };
}

export async function getFormatRepoPagePresentation(
  slug: string,
): Promise<FormatRepoPagePresentation> {
  if (slug === "bikini-bottom-dance-off") {
    return {
      kind: slug,
      trust: await getBikiniBottomDanceOffTrustData(),
      copy: {
        runDescription:
          "Add one song and optionally choose the dances or dialogue. The agent handles everything else.",
        examplesTitle: "Finished Dance Offs.",
      },
      detailedProofId: "bikini-bottom-dance-off-wiggle",
    };
  }

  if (slug === "animal-conversations") {
    return {
      kind: slug,
      trust: await getAnimalConversationsTrustData(),
      copy: {
        runDescription:
          "Send a supported video link or local clip. Your coding agent extracts the audio, prepares the dialogue for your approval, and makes the video. No timestamps to write.",
        examplesTitle: "Finished Conversations.",
        examplesDescription:
          "These examples were made with v0.15.1. The current download is v0.17.0, with multi-platform social distribution, easier setup, and a guided approval-to-export workflow.",
      },
    };
  }

  if (slug === "shaz-puppet-runtime") {
    return {
      kind: slug,
      trust: await getShazPuppetRuntimeTrustData(),
      copy: {
        runDescription:
          "Add a voice track and pick a room. The kit reads what Shaz is saying on your Mac, lip-syncs the mouth, and helps place an artist-reviewed gesture on the words that deserve one.",
        examplesTitle: "Examples",
        examplesDescription:
          "The first video proved Shaz could talk and gesture. In the new 30-second story, a fresh agent uses the transcript to land Think on “idea,” Point on “least,” and Confident on “best.” Play both with sound.",
      },
      detailedProofId: "shaz-puppet-runtime-talking-scene",
    };
  }

  const format = getDiscoveryFormatProfile(slug);
  if (format) {
    return {
      kind: "shared",
      package: getFormatRepoPackageData(format),
      copy: {
        runDescription: slug === "repo-builder"
          ? "Bring a reference and review the blueprint with your coding agent. This baseline guides analysis and Repo authoring; it does not promise an exact clone or automatically publish the result. Existing gameplay is sourced or supplied, not recreated."
          : format.packagePath
          ? "The agent reads this version’s instructions, checks the requirements, and walks you through the approved workflow. Review the inputs and estimate before starting."
          : "This collection contains saved examples, but does not yet include a runnable Repo.",
        examplesTitle: slug === "repo-builder" ? "The workflow & its evidence." : "Examples & references.",
        examplesDescription: slug === "repo-builder"
          ? "The diagram explains the workflow. The benchmark below records what was actually tested—and what still needs creative validation. It is not a finished Batman recreation."
          : `${format.proofEntries.length} saved examples for this recipe—not ${format.proofEntries.length} separate Repos. Each example keeps its original version and provenance.`,
      },
    };
  }

  throw new Error(
    `Format "${slug}" requires the shared rich Repo-page presentation before it can be published.`,
  );
}
