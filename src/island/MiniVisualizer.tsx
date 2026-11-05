import { useLevel } from "../hooks/useLevel";

const ENVELOPE = [0.62, 1, 0.85, 0.95, 0.55];

interface MiniVisualizerProps {
  visualizer: boolean;
  playing: boolean;
}

/**
 * Five-bar mini strip for the hover card and the panel. Reacting to the smoothed
 * output peak: it decays to a near-flat strip when nothing plays.
 */
export function MiniVisualizer({ visualizer, playing }: MiniVisualizerProps) {
  const level = useLevel();

  if (!visualizer) return null;

  const reach = visualizer && playing ? 5 + 15 * Math.pow(level, 0.7) : 4;

  return (
    <div className="mini-visualizer" aria-hidden="true">
      {ENVELOPE.map((factor, index) => (
        <span
          key={index}
          style={{
            height: `${Math.max(3, factor * reach)}px`,
          }}
        />
      ))}
    </div>
  );
}
