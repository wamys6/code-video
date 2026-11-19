import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const WIDTH = 96;
const HEIGHT = 54;
const PIXELS = WIDTH * HEIGHT;
const CONTEXT = 2;
const BLACK_LEVEL = 12;
const REFERENCE_LEVEL = 55;

async function* grayFrames(stream) {
  let frame = Buffer.allocUnsafe(PIXELS);
  let filled = 0;
  for await (const chunk of stream) {
    let offset = 0;
    while (offset < chunk.length) {
      const count = Math.min(PIXELS - filled, chunk.length - offset);
      chunk.copy(frame, filled, offset, offset + count);
      filled += count;
      offset += count;
      if (filled === PIXELS) {
        yield frame;
        frame = Buffer.allocUnsafe(PIXELS);
        filled = 0;
      }
    }
  }
  if (filled) throw Error('FFmpeg returned an incomplete inspection frame');
}

function classify(current, before, after) {
  const left = before.length ? before : after;
  const right = after.length ? after : before;
  if (!left.length) return null;

  let dark = 0;
  let newlyBlack = 0;
  for (let i = 0; i < PIXELS; i++) {
    if (current[i] > BLACK_LEVEL) continue;
    dark++;
    if (left.some(frame => frame[i] >= REFERENCE_LEVEL)
        && right.some(frame => frame[i] >= REFERENCE_LEVEL)) {
      newlyBlack++;
    }
  }
  if (dark / PIXELS >= .985 && newlyBlack / PIXELS >= .04) {
    return { kind: 'full-black', coverage: dark / PIXELS };
  }
  if (newlyBlack / PIXELS >= .20) {
    return { kind: 'large-black-region', coverage: newlyBlack / PIXELS };
  }
  return null;
}

export async function inspectVideoFrames(input, {
  ffmpeg = process.env.FILM_FFMPEG || 'ffmpeg', fps, allowedFrames = [],
} = {}) {
  if (!Array.isArray(allowedFrames) || !allowedFrames.every(n => Number.isSafeInteger(n) && n >= 0)) {
    throw Error('Allowed frames must be zero-based nonnegative integers');
  }
  if (fps !== undefined && (!Number.isFinite(fps) || fps <= 0)) {
    throw Error('FPS must be positive and finite');
  }
  const allowed = new Set(allowedFrames);
  const decoder = spawn(ffmpeg, [
    '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-i', resolve(input),
    '-map', '0:v:0', '-vf', 'scale=' + WIDTH + ':' + HEIGHT + ':flags=area,format=gray',
    '-fps_mode', 'passthrough', '-c:v', 'rawvideo', '-threads:v', '1', '-f', 'rawvideo', 'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const done = new Promise((resolve, reject) => {
    decoder.once('error', reject);
    decoder.once('close', code => code === 0 ? resolve() : reject(Error('Inspection decoder exited with code ' + code)));
  });

  const frames = [];
  const anomalies = [];
  let frameCount = 0;
  let windowStart = 0;
  let next = 0;
  let anyLight = false;
  let firstUnapproved;

  function record(frame, result) {
    anomalies.push({
      frame,
      ...(fps === undefined ? {} : { seconds: Number((frame / fps).toFixed(6)) }),
      kind: result.kind,
      coverage: Number(result.coverage.toFixed(4)),
    });
  }

  function inspectAvailable(atEnd = false) {
    while (next < frameCount && (atEnd || next + CONTEXT < frameCount)) {
      const center = next - windowStart;
      if (!allowed.has(next)) {
        const issue = classify(frames[center], frames.slice(0, center), frames.slice(center + 1, center + 1 + CONTEXT));
        if (issue) record(next, issue);
      }
      next++;
      if (next - windowStart > CONTEXT) {
        frames.shift();
        windowStart++;
      }
    }
  }

  async function scan() {
    for await (const frame of grayFrames(decoder.stdout)) {
      if (firstUnapproved === undefined && !allowed.has(frameCount)) firstUnapproved = frameCount;
      anyLight ||= frame.some(level => level > BLACK_LEVEL);
      frames.push(frame);
      frameCount++;
      inspectAvailable();
    }
    inspectAvailable(true);
  }

  try {
    await Promise.all([scan(), done]);
  } finally {
    if (decoder.pid && decoder.exitCode === null && decoder.signalCode === null) {
      decoder.kill();
      await done.catch(() => {});
    }
  }
  if (!frameCount) throw Error('No video frames decoded');
  if (!anyLight && firstUnapproved !== undefined) {
    record(firstUnapproved, { kind: 'entire-video-black', coverage: 1 });
  }
  return { frameCount, anomalies };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { fps: { type: 'string' }, 'allow-frame': { type: 'string', multiple: true } },
    });
    if (positionals.length !== 1) {
      throw Error('Usage: node inspect-video.mjs <video> [--fps <CFR fps>] [--allow-frame <zero-based index>]');
    }
    const allowedFrames = (values['allow-frame'] ?? []).map(value => /^\d+$/.test(value) ? Number(value) : NaN);
    const report = await inspectVideoFrames(positionals[0], {
      allowedFrames, fps: values.fps === undefined ? undefined : Number(values.fps),
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.anomalies.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
