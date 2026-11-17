export interface PeakState {
  height: number;
  velocity: number;
  holdRemaining: number;
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

const MAX_LIFT_VELOCITY = 6.5;
const MAX_LIFT_HEIGHT = 0.2;
const PEAK_CEILING = 1.12;
const RESTITUTION = 0.5;
const MIN_BOUNCE_VELOCITY = 0.35;
const CONTACT_EPSILON = 0.0075;

function freeMotion(previous: PeakState, delta: number, acceleration: number): PeakState {
  let height = previous.height;
  let velocity = Math.max(-MAX_LIFT_VELOCITY, finite(previous.velocity));
  let holdRemaining = Math.max(0, finite(previous.holdRemaining));
  let time = delta;
  if (velocity < 0) {
    const apexTime = -velocity / acceleration;
    const discriminant = velocity ** 2 - 2 * acceleration * (PEAK_CEILING - height);
    const ceilingTime = discriminant >= 0 ? (-velocity - Math.sqrt(discriminant)) / acceleration : Infinity;
    const risingTime = Math.min(time, apexTime, Math.max(0, ceilingTime));
    height -= velocity * risingTime + 0.5 * acceleration * risingTime ** 2;
    velocity += acceleration * risingTime;
    time -= risingTime;
    if (height >= PEAK_CEILING - 1e-10 || risingTime >= apexTime) {
      height = Math.min(PEAK_CEILING, height);
      velocity = 0;
    }
  }
  if (velocity >= 0 && time > 0) {
    const waitingTime = Math.min(time, holdRemaining);
    holdRemaining -= waitingTime;
    const fallingTime = time - waitingTime;
    height -= velocity * fallingTime + 0.5 * acceleration * fallingTime ** 2;
    velocity += acceleration * fallingTime;
  }
  return { height, velocity, holdRemaining };
}

export function advancePeaks(previous: readonly PeakState[], levels: readonly number[], deltaSeconds: number, holdMs: number, gravity: number, barVelocities: readonly number[] = []): PeakState[] {
  const delta = Math.max(0, Math.min(0.25, finite(deltaSeconds)));
  const hold = Math.max(0, Math.min(1_000, finite(holdMs, 240))) / 1_000;
  const acceleration = Math.max(40, Math.min(400, finite(gravity, 180))) / 10;
  return levels.map((value, index) => {
    const level = Math.max(0, Math.min(1, finite(value)));
    const old = previous[index];
    const height = Math.max(0, Math.min(PEAK_CEILING, finite(old?.height ?? 0)));
    const next = freeMotion({ height, velocity: old?.velocity ?? 0, holdRemaining: old?.holdRemaining ?? 0 }, delta, acceleration);
    const pushed = level > height + CONTACT_EPSILON;
    if (next.height <= level) {
      const platformSpeed = Math.max(0, finite(barVelocities[index]));
      const closingSpeed = Math.max(0, next.velocity + platformSpeed);
      const impactSpeed = platformSpeed + RESTITUTION * closingSpeed;
      const ceilingSpeed = Math.sqrt(2 * acceleration * Math.min(MAX_LIFT_HEIGHT, Math.max(0, PEAK_CEILING - level)));
      const resting = height <= level + CONTACT_EPSILON && Math.abs(old?.velocity ?? 0) < MIN_BOUNCE_VELOCITY && platformSpeed < 0.1;
      const launch = !resting && barVelocities.length > 0 && (level > 0.015 || platformSpeed > 0.1)
        ? Math.min(MAX_LIFT_VELOCITY, ceilingSpeed, impactSpeed) : 0;
      return {
        height: level,
        velocity: launch >= MIN_BOUNCE_VELOCITY ? -launch : 0,
        holdRemaining: pushed ? hold : next.holdRemaining,
      };
    }
    return next;
  });
}
