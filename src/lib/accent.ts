/**
 * Extracts a usable accent colour from the cover art so the island can tint
 * itself subtly. Runs once per distinct image on a tiny offscreen canvas.
 */
export async function extractAccent(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(image, 0, 0, 8, 8);
        const { data } = ctx.getImageData(0, 0, 8, 8);
        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255;
          if (alpha < 0.2) continue;
          // Weight saturated pixels a bit more so the tint is not muddy grey.
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const w = alpha * (0.35 + saturation);
          r += data[i] * w;
          g += data[i + 1] * w;
          b += data[i + 2] * w;
          weight += w;
        }
        if (weight === 0) return resolve(null);
        const lift = (value: number) => Math.min(255, Math.round(value / weight) + 24);
        resolve(`rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
