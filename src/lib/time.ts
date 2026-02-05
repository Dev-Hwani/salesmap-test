export function parseDurationToSeconds(value: string, fallbackSeconds: number) {
  if (!value) return fallbackSeconds;

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, Math.floor(numeric));
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      return fallbackSeconds;
  }
}
