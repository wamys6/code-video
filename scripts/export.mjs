import { spawn } from 'node:child_process';
import { existsSync, constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [input, output, chromiumPath] = process.argv.slice(2);
if (!input || !output || process.argv.length > 5 || !output.toLowerCase().endsWith('.webm')) {
  console.error('Usage: node export.mjs <film.html> <film.webm> [chromium-executable]');
  process.exit(1);
}

function findBrowser() {
  if (chromiumPath) return resolve(chromiumPath);
  const windowsRoots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  return windowsRoots.flatMap(root => [
    join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]).find(existsSync);
}

async function until(check, ms, failure) {
  const end = Date.now() + ms;
  do {
    const value = await check();
    if (value) return value;
    await pause(125);
  } while (Date.now() < end);
  throw new Error(failure);
}

let socket;
let browser;
let scratch;
try {
  if (typeof WebSocket !== 'function') throw new Error('The optional exporter needs Node.js 22 or later.');
  const executable = findBrowser();
  if (!executable || !existsSync(executable)) throw new Error('Pass the path to an installed Chromium browser as the third argument.');

  const url = pathToFileURL(await realpath(input)).href;
  const target = resolve(output);
  if (existsSync(target)) throw new Error('Output already exists. Choose a fresh file path.');

  const tempRoot = await realpath(tmpdir());
  scratch = await mkdtemp(join(tempRoot, 'code-video-'));
  const downloads = join(scratch, 'downloads');
  await mkdir(downloads);
  const profile = join(scratch, 'profile');

  let launchError;
  browser = spawn(executable, [
    '--headless', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => { launchError = error; });
  const devtools = await until(async () => {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error('Chromium closed before opening DevTools.');
    const contents = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    const [port, endpoint] = contents.trim().split(/\r?\n/);
    return /^\d+$/.test(port) && endpoint?.startsWith('/devtools/browser/') &&
      ('ws://127.0.0.1:' + port + endpoint);
  }, 15_000, 'Timed out waiting for Chromium to start.');

  socket = new WebSocket(devtools);
  await until(() => {
    if (socket.readyState === WebSocket.CLOSED) throw new Error('Chromium DevTools connection closed.');
    return socket.readyState === WebSocket.OPEN;
  }, 5000, 'Could not open Chromium DevTools.');

  let sequence = 0;
  let download;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      pending.get(message.id)?.(message);
    } else if (message.method === 'Browser.downloadProgress') {
      download = message.params;
    }
  });

  function cdp(method, params = {}, sessionId, timeout = 15_000) {
    return new Promise((accept, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(method + ' timed out.'));
      }, timeout);
      pending.set(id, message => {
        pending.delete(id);
        clearTimeout(timer);
        if (message.error) reject(new Error(method + ': ' + message.error.message));
        else accept(message.result);
      });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  await cdp('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true });
  const { targetInfos } = await cdp('Target.getTargets');
  const page = targetInfos.find(item => item.type === 'page' && item.url === 'about:blank');
  const targetId = page?.targetId ?? (await cdp('Target.createTarget', { url: 'about:blank' })).targetId;
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  const nav = await cdp('Page.navigate', { url }, sessionId);
  if (nav.errorText) throw new Error(nav.errorText);

  const evaluate = (expression, timeout, awaitPromise = false) =>
    cdp('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: awaitPromise }, sessionId, timeout);
  await until(async () => {
    const result = await evaluate('document.readyState === "complete" && !!globalThis.codeVideo?.export').catch(() => null);
    return result?.result?.value === true;
  }, 10_000, 'The HTML did not load a valid code-video film.');

  console.log('Encoding ' + basename(input) + ' in Chromium.');
  const job = await evaluate('globalThis.codeVideo.export()', 300_000, true);
  if (job.exceptionDetails) {
    throw new Error(job.exceptionDetails.exception?.description ?? job.exceptionDetails.text);
  }
  const info = job.result?.value;
  if (!info || !Number.isSafeInteger(info.frames) || info.frames <= 0) {
    throw new Error('The film did not return an export result.');
  }
  const artifact = await until(() => {
    if (download?.state === 'canceled') throw new Error('Chromium canceled the WebM download.');
    if (download?.state !== 'completed' || !/^[\w-]+$/.test(download.guid)) return false;
    const file = join(downloads, download.guid);
    return existsSync(file) && file;
  }, 15_000, 'Chromium did not finish writing the WebM.');
  await mkdir(dirname(target), { recursive: true });
  await copyFile(artifact, target, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ ...info, path: target }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (browser?.pid && browser.exitCode === null) browser.kill();
  if (scratch) {
    const actual = await realpath(scratch).catch(() => null);
    if (actual && dirname(actual) === await realpath(tmpdir()) && basename(actual).startsWith('code-video-')) {
      try {
        await rm(actual, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
      } catch (error) {
        console.error('Temporary browser profile could not be removed: ' + actual);
      }
    }
  }
}
