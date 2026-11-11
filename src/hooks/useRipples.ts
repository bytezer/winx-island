import { useCallback, useRef, useState, type PointerEvent } from "react";

export interface Ripple {
  id: number;
  x: number;
  y: number;
}

const MAX_RIPPLES = 3;

/**
 * Press feedback for the island: a water ripple at the cursor plus a short
 * scale compression anchored to the press point. Decorative only, so it is
 * skipped entirely when the system asks for reduced motion.
 */
export function useRipples() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setRipples((current) => current.filter((ripple) => ripple.id !== id));
  }, []);

  const spawn = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const originX = event.clientX - rect.left;
    const originY = event.clientY - rect.top;

    // Horizontal centre is fixed while the island grows symmetrically, the top
    // edge never moves; anchoring to both keeps the ripple under the cursor.
    const id = nextId.current++;
    const ripple: Ripple = { id, x: originX - rect.width / 2, y: originY };
    setRipples((current) => [...current, ripple].slice(-MAX_RIPPLES));

    // The scale runs from the press point, not the island centre, so the pill
    // compresses towards the click instead of shaking as a whole.
    element.style.transformOrigin = `${originX}px ${originY}px`;
    if (typeof element.animate === "function") {
      element.animate(
        [{ transform: "scale(0.985)" }, { transform: "scale(1)" }],
        { duration: 160, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      );
    }
  }, []);

  return { ripples, spawn, dismiss };
}
