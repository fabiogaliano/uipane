export type SpringAnimConfig = {
  stiffness?: number;
  damping?: number;
  mass?: number;
};

export type AnimationHandle = {
  stop: () => void;
};

export function animateSpring(
  from: number,
  to: number,
  config: SpringAnimConfig,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): AnimationHandle {
  const { stiffness = 300, damping = 25, mass = 0.8 } = config;
  let position = from;
  let velocity = 0;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let stopped = false;

  function tick(now: number) {
    if (stopped) return;
    if (lastTime === null) {
      lastTime = now;
      rafId = requestAnimationFrame(tick);
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;

    const force = -stiffness * (position - to);
    const dampForce = -damping * velocity;
    const accel = (force + dampForce) / mass;
    velocity += accel * dt;
    position += velocity * dt;

    if (Math.abs(position - to) < 0.001 && Math.abs(velocity) < 0.01) {
      onUpdate(to);
      onComplete?.();
      return;
    }

    onUpdate(position);
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}

export function animateValue(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): AnimationHandle {
  const startTime = performance.now();
  let rafId: number | null = null;
  let stopped = false;

  function tick(now: number) {
    if (stopped) return;
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (to - from) * eased;
    onUpdate(value);

    if (t >= 1) {
      onComplete?.();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}
