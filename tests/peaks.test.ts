import assert from "node:assert/strict";
import test from "node:test";
import { advancePeaks } from "../src/lib/peaks";

test("PEAK-01: a rising band pushes its own marker immediately", () => {
  const peaks = advancePeaks([], [0.8, 0.2], 0.016, 240, 180);
  assert.equal(peaks[0].height, 0.8);
  assert.equal(peaks[1].height, 0.2);
  assert.equal(peaks[0].velocity, 0);
  assert.equal(peaks[0].holdRemaining, 0.24);
});

test("PEAK-02: a falling bar leaves its marker suspended during hold", () => {
  const initial = advancePeaks([], [0.8], 0, 200, 180);
  const held = advancePeaks(initial, [0.1], 0.1, 200, 180);
  assert.equal(held[0].height, 0.8);
  assert.equal(held[0].velocity, 0);
  assert.ok(Math.abs(held[0].holdRemaining - 0.1) < 1e-9);
  const falling = advancePeaks(held, [0.1], 0.15, 200, 180);
  assert.ok(falling[0].height < 0.8 && falling[0].height > 0.1);
  assert.ok(falling[0].velocity > 0);
});

test("PEAK-03: gravity accelerates the marker without crossing its bar", () => {
  const initial = [{ height: 0.9, velocity: 0, holdRemaining: 0 }];
  const first = advancePeaks(initial, [0.1], 0.1, 200, 180);
  const second = advancePeaks(first, [0.1], 0.1, 200, 180);
  assert.ok(first[0].height - second[0].height > initial[0].height - first[0].height);
  let state = second;
  for (let index = 0; index < 40; index++) state = advancePeaks(state, [0.1], 0.1, 200, 180);
  assert.ok(state[0].height >= 0.1);
});

test("PEAK-04: a new high resets the hold and downward velocity", () => {
  const previous = [{ height: 0.4, velocity: 0.9, holdRemaining: 0 }];
  const [peak] = advancePeaks(previous, [0.95], 0.016, 300, 180);
  assert.equal(peak.height, 0.95);
  assert.equal(peak.velocity, 0);
  assert.equal(peak.holdRemaining, 0.3);
});

test("PEAK-05: silence clears the peak and invalid samples stay finite", () => {
  let state = advancePeaks([], [0.9, NaN, Infinity, -1], 0, 200, 180);
  for (let index = 0; index < 80; index++) state = advancePeaks(state, [0, 0, 0, 0], 0.05, 200, 180);
  assert.ok(state.every((peak) => peak.height === 0 && Number.isFinite(peak.velocity)));
});

test("PEAK-06: fall is time based rather than frame based", () => {
  const initial = [{ height: 0.8, velocity: 0, holdRemaining: 0.02 }];
  const [single] = advancePeaks(initial, [0], 0.1, 200, 180);
  let subdivided = initial;
  for (let index = 0; index < 10; index++) subdivided = advancePeaks(subdivided, [0], 0.01, 200, 180);
  assert.ok(single.height < initial[0].height && single.height > 0.7);
  assert.ok(Math.abs(single.height - subdivided[0].height) < 1e-8);
});

test("PEAK-07: repeated frames at the same maximum do not restart the hold timer", () => {
  const initial = advancePeaks([], [0.8], 0, 240, 180);
  const repeated = advancePeaks(initial, [0.8], 0.1, 240, 180);
  assert.ok(Math.abs(repeated[0].holdRemaining - 0.14) < 1e-9);
});

test("PEAK-08: subpixel jitter does not repeatedly suspend the marker", () => {
  let state = advancePeaks([], [0.8], 0, 240, 180);
  state = advancePeaks(state, [0.804], 0.1, 240, 180);
  state = advancePeaks(state, [0.801], 0.1, 240, 180);
  assert.ok(state[0].holdRemaining < 0.05);
  assert.ok(state[0].height >= 0.801);
});

test("FLUID-03: contact transfers upward velocity before a smooth apex and fall", () => {
  let state = advancePeaks([{ height: 0.3, velocity: 0.6, holdRemaining: 0 }], [0.4], 1 / 120, 0, 180, [1]);
  assert.equal(state[0].height, 0.4);
  assert.ok(state[0].velocity < 0);
  const heights = [state[0].height];
  for (let frame = 0; frame < 120; frame++) {
    state = advancePeaks(state, [0.2], 1 / 120, 0, 180, [0]);
    heights.push(state[0].height);
  }
  assert.ok(heights[1] > heights[0]);
  const maximum = Math.max(...heights);
  assert.ok(maximum > 0.42 && maximum < 0.75);
  assert.ok(heights.at(-1)! < maximum);
  assert.ok(heights.every((height, index) => index === 0 || Math.abs(height - heights[index - 1]) < 0.03));
});

test("FLUID-04: upward coast, apex hold and gravity agree at 30, 60 and 120 Hz", () => {
  const finals = [30, 60, 120].map(rate => {
    let state = [{ height: 0.4, velocity: -1, holdRemaining: 0.08 }];
    for (let step = 0; step < Math.round(rate * 0.3); step++) state = advancePeaks(state, [0], 1 / rate, 80, 180);
    return state[0];
  });
  for (const state of finals) {
    assert.ok(Math.abs(state.height - finals[0].height) < 1e-9);
    assert.ok(Math.abs(state.velocity - finals[0].velocity) < 1e-9);
  }
});

test("IMPACT-02: maximum gravity drops a free marker to silence within 200 ms", () => {
  let state = [{ height: 0.8, velocity: 0, holdRemaining: 0 }];
  for (let step = 0; step < 24; step++) state = advancePeaks(state, [0], 1 / 120, 0, 400, [0]);
  assert.ok(state[0].height < 0.01, `floating: ${state[0].height}`);
});

test("IMPACT-03: falling markers rebound and rising bars launch them into free flight", () => {
  const falling = advancePeaks([{ height: 0.22, velocity: 4, holdRemaining: 0 }], [0.2], 1 / 60, 0, 180, [0]);
  assert.equal(falling[0].height, 0.2);
  assert.ok(falling[0].velocity < -1);
  let state = advancePeaks([{ height: 0.3, velocity: 1, holdRemaining: 0 }], [0.31], 1 / 120, 0, 180, [1]);
  assert.ok(state[0].velocity < -1, "launch must outrun the rising bar");
  for (let step = 1; step <= 5; step++) {
    const bar = 0.31 + step / 120;
    state = advancePeaks(state, [bar], 1 / 120, 0, 180, [1]);
    assert.ok(state[0].height > bar, "marker stuck to its pushing bar");
  }
});

test("IMPACT-04: stationary contact never creates energy from gravity at any refresh rate", () => {
  for (const rate of [30, 60, 120]) {
    let state = [{ height: 0.2, velocity: 0, holdRemaining: 0 }];
    for (let step = 0; step < rate; step++) {
      state = advancePeaks(state, [0.2], 1 / rate, 0, 400, [0]);
      assert.equal(state[0].height, 0.2);
      assert.equal(state[0].velocity, 0);
    }
  }
});

test("IMPACT-06: strong hits produce short arcs rather than long flights to the ceiling", () => {
  let state = advancePeaks([{ height: 0.29, velocity: 2, holdRemaining: 0 }], [0.3], 1 / 120, 0, 180, [8]);
  let maximum = state[0].height;
  let descending = false;
  let landed = false;
  for (let step = 0; step < 42; step++) {
    state = advancePeaks(state, [0.3], 1 / 120, 0, 180, [0]);
    maximum = Math.max(maximum, state[0].height);
    if (state[0].velocity > 0) descending = true;
    if (descending && state[0].velocity < 0) { landed = true; break; }
  }
  assert.ok(maximum <= 0.501, `excessive launch: ${maximum}`);
  assert.ok(landed, "first flight lasted longer than 350 ms");
});
