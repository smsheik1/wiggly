/** Measured in Phase 3. Null means the worker refuses to start the crew and charges nothing. */
export const CREW_FEE_CREDITS: number | null = null;

export function crewFeeCredits() {
  return CREW_FEE_CREDITS;
}

export function crewFeeMissingError() {
  return [
    "The crew fee is not set, so this film was not started and nothing was charged.",
    "1. Run the OpenRouter rehearsal and convert the bill at 1 credit per cent, rounded up.",
    "2. Write that number into CREW_FEE_CREDITS in v3/features/mcp/crew-fee.ts.",
    "3. Restart wiggly-v3-mcp-draft.",
  ].join("\n");
}
