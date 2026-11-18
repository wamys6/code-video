// Include with build.mjs --include assets/character-motion.js.
const characterMotion = (() => {
  const clamp = n => Math.min(1, Math.max(0, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  function currentKey(keys, frame) {
    let i = 0;
    while (i + 1 < keys.length && frame >= keys[i + 1].frame) i++;
    return i;
  }

  // Numeric poses are complete snapshots. The destination key can set easing to 'hold' or 'linear'.
  function poseAt(keys, frame) {
    const i = currentKey(keys, frame);
    const a = keys[i], b = keys[i + 1];
    if (!b || frame <= a.frame || b.easing === 'hold') return a.pose;
    const fraction = (frame - a.frame) / (b.frame - a.frame);
    const t = b.easing === 'linear' ? fraction : smooth(fraction);
    return Object.fromEntries(Object.keys(a.pose).map(key => [key, lerp(a.pose[key], b.pose[key], t)]));
  }

  function celAt(keys, frame) {
    return keys[currentKey(keys, frame)].value;
  }

  // One world-space foot. It stays exactly at its landing position between swings.
  function footAt(frame, planted, swings) {
    let point = planted;
    for (const { from, to, x, height } of swings) {
      if (frame < from) break;
      if (frame < to) {
        const t = clamp((frame - from) / (to - from));
        return { x: lerp(point.x, x, smooth(t)), y: point.y - Math.sin(t * Math.PI) * height };
      }
      point = { x, y: point.y };
    }
    return point;
  }

  // Two-bone IK. bend = 1 or -1 selects a geometric side of the root→target line.
  function limb(root, target, upper, lower, bend = 1) {
    let dx = target.x - root.x, dy = target.y - root.y;
    const requested = Math.hypot(dx, dy);
    if (requested) { dx /= requested; dy /= requested; }
    else { dx = 1; dy = 0; }
    const minReach = Math.abs(upper - lower) + .0001, maxReach = upper + lower - .0001;
    const distance = Math.max(minReach, Math.min(maxReach, requested));
    const offset = (distance * distance + upper * upper - lower * lower) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - offset * offset)) * bend;
    return {
      joint: { x: root.x + dx * offset - dy * height, y: root.y + dy * offset + dx * height },
      end: { x: root.x + dx * distance, y: root.y + dy * distance },
      error: Math.abs(requested - distance),
    };
  }

  // In a y-down canvas, a right-facing knee above its ankle bends toward +x.
  // Choose the side by its projection onto a pose direction supplied by the caller.
  function limbToward(root, target, upper, lower, toward) {
    const side = (target.x - root.x) * toward.y - (target.y - root.y) * toward.x;
    return limb(root, target, upper, lower, side < 0 ? -1 : 1);
  }

  // Cues are absolute movie times in seconds. End is exclusive and gaps hold the rest mouth.
  function mouthAt(cues, frame, fps) {
    const seconds = frame / fps;
    return cues.find(cue => cue.from <= seconds && seconds < cue.to)?.shape ?? 'rest';
  }

  return { poseAt, celAt, footAt, limb, limbToward, mouthAt };
})();
