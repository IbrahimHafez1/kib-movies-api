const UNIT_TO_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Converts duration strings like "15m", "7d" or "30s" to milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration "${duration}"; expected formats like 30s, 15m, 12h, 7d`);
  }
  return Number(match[1]) * UNIT_TO_MS[match[2]];
}
