import { chromium } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { mkdir, mkdtemp, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseArgs, promisify } from 'node:util';
import { createServer } from 'vite';
import { film } from './config.mjs';
import { inspectVideoFrames } from './inspect-video.mjs';

const exec = promisify(execFile);
const { values } = parseArgs({ options: {
  samples: { type: 'boolean' }, preview: { type: 'boolean' }, audio: { type: 'string' },
  hybrid: { type: 'boolean' },
} });
const { samples, preview, audio } = values;
if (samples && (preview || audio)) throw Error('--samples cannot be combined with --preview or --audio');

const { fps } = film;
const [width, height] = samples || preview ? film.sampleSize : film.size;
const frameCount = Math.round((preview ? Math.min(2, film.seconds) : film.seconds) * fps);
if (![width, height].every(n => Number.isInteger(n) && n > 0 && n % 2 === 0)
    || !Number.isInteger(fps) || fps <= 0 || !Number.isSafeInteger(frameCount) || frameCount < 1) {
  throw Error('Set positive, even dimensions, an integer frame rate, and a positive duration in config.mjs');
}
const seconds = frameCount / fps;
const ffmpeg = process.env.FILM_FFMPEG || 'ffmpeg';
const ffprobe = process.env.FILM_FFPROBE || 'ffprobe';
const sound = audio && resolve(audio);

if (!samples) {
  for (const binary of [ffmpeg, ffprobe]) {
    try { await exec(binary, ['-version']); }
    catch (error) { throw Error('Cannot run ' + binary + ': ' + error.message); }
  }
  if (sound && !(await stat(sound)).isFile()) throw Error('Audio input must be a file');
}

await mkdir('renders', { recursive: true });
const dir = await mkdtemp(join(resolve('renders'), (samples ? 'samples' : preview ? 'preview' : 'final') + '-'));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error' });
await server.listen();

let browser;
let encoder;
let encoderDone;
let partial;
try {
  const args = ['--enable-gpu', '--ignore-gpu-blocklist'];
  if (process.env.FILM_ANGLE) args.push('--use-angle=' + process.env.FILM_ANGLE);
  browser = await chromium.launch({
    headless: true, args, executablePath: process.env.FILM_CHROMIUM || undefined,
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', response => {
    if (!response.ok()) errors.push(response.status() + ' ' + response.url());
  });
  const query = new URLSearchParams({ export: '1' });
  if (values.hybrid) query.set('hybrid', '1');
  await page.goto(server.resolvedUrls.local[0] + '?' + query);
  try {
    await page.waitForFunction(() => window.filmReady || window.filmError, undefined, { timeout: 45000 });
  } catch (error) {
    throw Error(errors[0] || error.message);
  }
  const startupError = await page.evaluate(() => window.filmError);
  if (startupError) throw Error(startupError);
  console.log(await page.evaluate(() => window.filmInfo()));

  async function capture(t, mime) {
    const data = await page.evaluate(async ({ t, mime, width, height }) => {
      await window.renderAt(t);
      const canvas = document.querySelector('#film');
      if (canvas.width !== width || canvas.height !== height) throw Error('Canvas pixels do not match requested size');
      return canvas.toDataURL(mime, .97).split(',')[1];
    }, { t, mime, width, height });
    if (errors.length) throw Error('At ' + t.toFixed(3) + 's: ' + errors[0]);
    const bytes = Buffer.from(data || '', 'base64');
    if (!bytes.length) throw Error('Canvas capture returned an empty frame');
    return bytes;
  }

  if (samples) {
    const times = film.sampleTimes.filter(t => Number.isFinite(t) && t >= 0 && t <= film.seconds);
    const representative = times[Math.floor(times.length / 2)] ?? film.seconds / 2;
    const before = await capture(representative, 'image/png');
    await capture(representative / 2, 'image/png');
    const after = await capture(representative, 'image/png');
    if (!before.equals(after)) throw Error('A → B → A returned different frames at ' + representative + 's');
    for (const t of times) {
      const path = join(dir, 'at-' + t.toFixed(3) + 's.png');
      await writeFile(path, await capture(t, 'image/png'));
      console.log(path);
    }
    console.log('Random access verified at ' + representative + 's');
  } else {
    partial = join(dir, 'pending.mp4');
    const output = join(dir, 'film.mp4');
    encoder = spawn(ffmpeg, [
      '-n', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      ...(sound ? ['-i', sound] : []),
      '-vf', 'scale=in_range=full:out_range=limited:out_color_matrix=bt709',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', preview ? '20' : '17', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...(sound ? ['-af', 'apad', '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
      '-movflags', '+faststart', '-t', seconds.toFixed(9), partial,
    ], { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true });
    encoderDone = new Promise((resolve, reject) => {
      encoder.once('error', reject);
      encoder.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg exited with code ' + code)));
    });

    async function* frames() {
      for (let frame = 0; frame < frameCount; frame++) {
        const t = frame / fps;
        yield await capture(t, 'image/jpeg');
        if ((frame + 1) % fps === 0 || frame + 1 === frameCount) {
          console.log('Rendered ' + (frame + 1) + '/' + frameCount);
        }
      }
    }

    await Promise.all([pipeline(Readable.from(frames(), { objectMode: false }), encoder.stdin), encoderDone]);
    const { stdout } = await exec(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', partial]);
    const { streams } = JSON.parse(stdout);
    const video = streams.find(stream => stream.codec_type === 'video');
    const track = streams.find(stream => stream.codec_type === 'audio');
    if (video?.codec_name !== 'h264' || video.width !== width || video.height !== height
        || Number(video.nb_read_frames) !== frameCount || Math.abs(Number(video.duration) - seconds) > .001
        || video.r_frame_rate !== fps + '/1' || (sound ? track?.codec_name !== 'aac' : Boolean(track))) {
      throw Error('Encoded frames, size, timing, or audio stream do not match the requested output');
    }
    const inspection = await inspectVideoFrames(partial, { ffmpeg, fps, allowedFrames: film.allowedBlackFrames });
    if (inspection.frameCount !== frameCount) throw Error('Frame inspection did not decode the expected frame count');
    if (inspection.anomalies.length) {
      const failed = join(dir, 'failed-inspection.mp4');
      const report = join(dir, 'frame-inspection.json');
      await rename(partial, failed);
      partial = undefined;
      await writeFile(report, JSON.stringify(inspection, null, 2) + '\n');
      for (const { frame, seconds, kind } of inspection.anomalies.slice(0, 8)) {
        console.error('Frame ' + frame + ' (' + seconds.toFixed(3) + 's): ' + kind);
      }
      throw Error('Visual inspection flagged ' + inspection.anomalies.length + ' frame(s). See ' + report + ' and ' + failed);
    }
    if (sound) await exec(ffmpeg, ['-v', 'error', '-xerror', '-i', partial, '-map', '0:a:0', '-f', 'null', '-']);
    await rename(partial, output);
    partial = undefined;
    console.log(output + ' · ' + width + '×' + height + ' · ' + fps + ' fps · ' + seconds + 's · ' + (sound ? 'AAC' : 'silent'));
  }
} finally {
  if (encoder?.pid && encoder.exitCode === null && encoder.signalCode === null) {
    encoder.kill();
    await encoderDone.catch(() => {});
  }
  if (partial) await unlink(partial).catch(error => {
    if (error.code !== 'ENOENT') console.error('Could not remove unfinished output: ' + error.message);
  });
  try {
    if (browser) await browser.close();
  } finally {
    await server.close();
  }
}
