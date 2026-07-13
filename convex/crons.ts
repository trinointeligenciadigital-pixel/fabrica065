import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("limpar sessoes expiradas", { hours: 1 }, internal.sessions.cleanupExpired);
export default crons;