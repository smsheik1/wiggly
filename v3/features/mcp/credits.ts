/** One credit is one cent of the $19 balance. Rates are about twice the live provider price. */
export const MONTHLY_CREDIT_GRANT = 1900;
export const CREDIT_PACK_PRICE_CENTS = 1900;
export const CREDIT_PACK_GRANT = 1900;
export const SUBSCRIPTION_CHECKOUT_URL = "https://wiggly.agentenamel.com/billing/credits?plan=monthly";
export const CREDIT_PACK_CHECKOUT_URL = "https://wiggly.agentenamel.com/billing/credits?pack=1900";

export const VIDEO_CREDITS_PER_SECOND = 21;
export const IMAGE_CREDITS = 8;
export const VOICE_CHARACTERS_PER_CREDIT = 100;

export function generationCredits(input: {
  videoSeconds: number;
  images: number;
  voiceCharacters: number;
}) {
  const video = input.videoSeconds * VIDEO_CREDITS_PER_SECOND;
  const images = input.images * IMAGE_CREDITS;
  const voice = Math.ceil(input.voiceCharacters / VOICE_CHARACTERS_PER_CREDIT);
  return { video, images, voice, total: video + images + voice };
}
