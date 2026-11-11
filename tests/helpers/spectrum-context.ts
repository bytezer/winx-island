export class SpectrumContext {
  globalAlpha = 1;
  shadowBlur = 0;
  shadowColor = "";
  fillStyle: unknown = "";
  rectangles: { kind: string; x: number; y: number; width: number; height: number; radius: number; color: unknown }[] = [];
  circles: { x: number; y: number; radius: number }[] = [];
  gradients: { coordinates: number[]; stops: [number, string][] }[] = [];
  clearRect() {}
  beginPath() {}
  fill() {}
  roundRect(x: number, y: number, width: number, height: number, radius: number) {
    this.rectangles.push({ kind: "bar", x, y, width, height, radius, color: this.fillStyle });
  }
  fillRect(x: number, y: number, width: number, height: number) {
    this.rectangles.push({ kind: "peak", x, y, width, height, radius: 0, color: this.fillStyle });
  }
  arc(x: number, y: number, radius: number) { this.circles.push({ x, y, radius }); }
  createLinearGradient(...coordinates: number[]) {
    const gradient = { coordinates, stops: [] as [number, string][], addColorStop(offset: number, color: string) { this.stops.push([offset, color]); } };
    this.gradients.push(gradient);
    return gradient;
  }
  context() { return this as unknown as CanvasRenderingContext2D; }
}
