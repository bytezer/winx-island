import { Waveform } from "./Waveform";

interface MiniVisualizerProps {
  visualizer: boolean;
  playing: boolean;
}

export function MiniVisualizer({ visualizer, playing }: MiniVisualizerProps) {
  if (!visualizer) return null;

  return (
    <div className="mini-visualizer">
      <Waveform visualizer={visualizer} playing={playing} />
    </div>
  );
}
