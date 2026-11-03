export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Turns an app user model id into something readable: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify" -> "Spotify". */
export function readableSourceApp(id: string): string {
  if (!id) return "";
  const bare = id.split("!")[0] ?? "";
  // Sessions coming from unpackaged players often report a raw GUID, which is
  // meaningless to a human, so only package style ids are rendered.
  if (!bare.includes(".")) return "";
  const first = bare.split(".")[0] ?? "";
  const cleaned = first.split("_")[0] ?? "";
  const pretty = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return pretty.length >= 2 && pretty.length <= 24 ? pretty : "";
}
