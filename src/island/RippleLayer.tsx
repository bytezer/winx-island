import type { Ripple } from "../hooks/useRipples";

interface RippleLayerProps {
  ripples: Ripple[];
  onDismiss: (id: number) => void;
}

/** Decorative water rings painted under the island content. */
export function RippleLayer({ ripples, onDismiss }: RippleLayerProps) {
  return (
    <div className="ripple-layer" aria-hidden="true">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{ left: `calc(50% + ${ripple.x}px)`, top: ripple.y }}
          onAnimationEnd={(event) => {
            // The wrapper animation exists only so the node can remove itself;
            // child animations bubble up here too, so match it by name.
            if (event.animationName === "ripple-life") onDismiss(ripple.id);
          }}
        >
          <span className="ripple-ring" />
          <span className="ripple-ring" style={{ animationDelay: "90ms" }} />
          <span className="ripple-core" />
        </span>
      ))}
    </div>
  );
}
