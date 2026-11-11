import { useLevel } from "../hooks/useLevel";
import { AUDIO_NOISE_FLOOR } from "../lib/visualizer";
import type { MediaSnapshot } from "../types";
import { CoverArt } from "./CoverArt";
import { Waveform } from "./Waveform";

interface CompactPillProps {
  media: MediaSnapshot;
  clock: string;
  visualizer: boolean;
}

export function CompactPill({ media, clock, visualizer }: CompactPillProps) {
  const level = useLevel();
  const systemAudio = visualizer && level > AUDIO_NOISE_FLOOR;

  if (!media.available && !systemAudio) {
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
      <Waveform playing={media.playing} visualizer={visualizer} />
    </div>
  );
}
