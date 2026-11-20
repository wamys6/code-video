import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [input, output, ...marks] = process.argv.slice(2);
if (!input || !output?.toLowerCase().endsWith('.html') || !marks.length) {
  throw Error('Usage: node review-frames.mjs input-video new-review.html "59=Before cut" "60=After cut"');
}
const frames = marks.map(mark => {
  const match = /^(\d+)(?:=(.*))?$/u.exec(mark);
  if (!match || !Number.isSafeInteger(Number(match[1]))) throw Error('Invalid frame: ' + mark);
  return { number: Number(match[1]), label: match[2] || '' };
}).sort((a,b) => a.number - b.number);
if (new Set(frames.map(f => f.number)).size !== frames.length) throw Error('Use each frame number once');

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const scratch = await mkdtemp(join(tmpdir(), 'film-review-'));
try {
  const select = frames.map(f => 'eq(n,' + f.number + ')').join('+');
  execFileSync(process.env.FILM_FFMPEG || 'ffmpeg', [
    '-nostdin', '-v', 'error', '-i', resolve(input), '-map', '0:v:0',
    '-vf', "select='" + select + "',scale=640:640:force_original_aspect_ratio=decrease",
    '-fps_mode', 'passthrough', '-frames:v', String(frames.length),
    join(scratch, '%09d.png'),
  ], { windowsHide: true, stdio: ['ignore','ignore','inherit'] });
  const pictures = (await readdir(scratch)).sort();
  if (pictures.length !== frames.length) throw Error('Frame ' + frames[pictures.length].number + ' exceeds the decoded video length');
  const cards = [];
  for (const [i, picture] of pictures.entries()) {
    const bytes = await readFile(join(scratch,picture));
    const {number,label} = frames[i];
    cards.push('<figure><img alt="Frame ' + number + '" src="data:image/png;base64,' + bytes.toString('base64')
      + '"><figcaption>#' + number + ' ' + escape(label) + '</figcaption></figure>');
  }
  await writeFile(output, '<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Frame review</title>'
    + '<style>body{background:#15191e;color:white;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:1rem;font:16px system-ui}figure{margin:0}img{display:block;width:100%}figcaption{padding:.45rem 0}</style>'
    + '<body>' + cards.join('\n') + '</body></html>', {flag:'wx'});
  console.log(resolve(output));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
