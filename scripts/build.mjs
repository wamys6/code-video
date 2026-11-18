import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';

const [source, target, ...options] = process.argv.slice(2);
if (!source || !target || options.length % 2 !== 0) {
  console.error('Usage: node build.mjs <film.scene.js> <film.html> [--include script.js] [--audio name=file.wav]');
  process.exit(1);
}

const audioTypes = new Map([
  ['wav', 'audio/wav'], ['mp3', 'audio/mpeg'], ['ogg', 'audio/ogg'],
  ['opus', 'audio/ogg'], ['m4a', 'audio/mp4'], ['webm', 'audio/webm'],
]);

try {
  if (!target.toLowerCase().endsWith('.html')) throw new Error('Output must end in .html.');
  const code = await readFile(source, 'utf8');
  const includes = [];
  const audio = Object.create(null);
  for (let i = 0; i < options.length; i += 2) {
    const [flag, value] = options.slice(i, i + 2);
    if (flag === '--include') {
      includes.push(await readFile(value, 'utf8'));
    } else if (flag === '--audio') {
      const equals = value.indexOf('=');
      const name = value.slice(0, equals);
      const file = value.slice(equals + 1);
      const mediaType = audioTypes.get(file.split('.').at(-1).toLowerCase());
      if (!/^[a-z][a-z0-9_-]*$/i.test(name) || !mediaType || equals < 1 || name in audio) {
        throw new Error('Expected a unique audio name and a supported file: --audio name=file.wav');
      }
      audio[name] = 'data:' + mediaType + ';base64,' + (await readFile(file)).toString('base64');
    } else {
      throw new Error('Unknown build option: ' + flag);
    }
  }
  const contents = includes.concat(code).join('\n');
  if (/<\/script/i.test(contents)) {
    throw new Error('Scene source contains a closing script tag. Escape it before embedding.');
  }
  const scene = 'const { film, drawFrame } = (() => {\n' +
    (Object.keys(audio).length ? 'const audioAssets = Object.freeze(' + JSON.stringify(audio) + ');\n' : '') +
    contents +
    '\nreturn { film, drawFrame };\n})();';
  new Script(scene, { filename: source });
  const [template, playerAudio] = await Promise.all([
    readFile(new URL('../assets/player.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/player-audio.js', import.meta.url), 'utf8'),
  ]);
  const html = template.replace('/* @code-video:audio */', () => playerAudio)
    .replace('/* @code-video:scene */', () => scene);
  await mkdir(dirname(resolve(target)), { recursive: true });
  await writeFile(target, html, 'utf8');
  console.log(resolve(target));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
