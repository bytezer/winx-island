import type { MediaSnapshot } from "../types";
import { CoverArt } from "./CoverArt";
import { Waveform } from "./Waveform";

interface CompactPillProps {
  media: MediaSnapshot;
  clock: string;
}

export function CompactPill({ media, clock }: CompactPillProps) {
  if (!media.available) {
    return (
      <div className="compact compact-idle">
        <span className="idle-dot" />
        <span className="compact-clock">{clock}</span>
      </div>
    );
  }

  return (
    <div className="compact">
      <CoverArt src={media.art} size={26} radius={8} />
      <Waveform playing={media.playing} />
    </div>
  );
}
