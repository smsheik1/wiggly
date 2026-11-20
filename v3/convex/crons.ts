import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "expire stale shaz studio media",
  { hourUTC: 11, minuteUTC: 0 },
  internal.studioMedia.sweepExpired,
  {},
);

export default crons;
