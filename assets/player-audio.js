// Audio is optional. One mix is shared by the preview clock and the encoder.
const audioRate = 48_000;
const audioChannels = 2;
const opusFrames = 960; // 20 ms at 48 kHz
const opusMicros = 20_000;

async function prepareSound(clips, seconds) {
  if (clips === undefined) return null;
  if (!Array.isArray(clips)) throw new Error('film.audioClips 应为数组。');
  if (!clips.length) return null;
  if (!window.OfflineAudioContext) throw new Error('此浏览器不能离线混合音轨。');

  const mix = new OfflineAudioContext(audioChannels, Math.round(seconds * audioRate), audioRate);
  const sources = new Map();
  for (const [i, clip] of clips.entries()) {
    const { src, at = 0, offset = 0, gain = 1, duration } = clip ?? {};
    if (typeof src !== 'string' || !src.startsWith('data:audio/') ||
        ![at, offset, gain].every(Number.isFinite) || at < 0 || at >= seconds || offset < 0 || gain < 0 ||
        (duration !== undefined && (!Number.isFinite(duration) || duration <= 0))) {
      throw new Error('音频片段 ' + (i + 1) + ' 缺少内嵌音频或时间配置有误。');
    }
    if (!sources.has(src)) {
      const decoded = fetch(src).then(response => response.arrayBuffer()).then(data => mix.decodeAudioData(data));
      sources.set(src, decoded);
    }
  }
  await Promise.all(sources.values());
  for (const { src, at = 0, offset = 0, gain = 1, duration } of clips) {
    const audio = await sources.get(src);
    const playTime = Math.min(duration ?? Infinity, seconds - at, audio.duration - offset);
    if (!(playTime > 0)) throw new Error('音频裁切起点超出素材时长。');
    const source = mix.createBufferSource();
    source.buffer = audio;
    const level = mix.createGain();
    level.gain.value = gain;
    source.connect(level).connect(mix.destination);
    source.start(at, offset, playTime);
  }
  return mix.startRendering();
}

async function encodeSound(buffer) {
  if (!buffer) return null;
  if (!window.AudioEncoder || !window.AudioData) {
    throw new Error('当前浏览器缺少 WebCodecs 音频编码。预览仍可播放，导出有声 WebM 请使用支持 Opus 编码的 Chromium 浏览器。');
  }
  const config = { codec: 'opus', sampleRate: audioRate, numberOfChannels: audioChannels, bitrate: 96_000,
    opus: { format: 'opus', frameDuration: opusMicros } };
  if (!(await AudioEncoder.isConfigSupported(config)).supported) {
    throw new Error('当前浏览器不支持 Opus 音频导出。');
  }

  const packets = [];
  let header;
  let failure;
  const encoder = new AudioEncoder({
    output(chunk, metadata) {
      const description = metadata?.decoderConfig?.description;
      if (description && !header) {
        header = ArrayBuffer.isView(description)
          ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength).slice()
          : new Uint8Array(description).slice();
      }
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      packets.push({ ms: Math.round(chunk.timestamp / 1000), duration: chunk.duration, bytes });
    },
    error(error) { failure = error; },
  });

  try {
    encoder.configure(config);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let start = 0; start < buffer.length; start += opusFrames) {
      while (encoder.encodeQueueSize > 48 && !failure) await new Promise(resolve => setTimeout(resolve, 4));
      if (failure) throw failure;
      const length = Math.min(opusFrames, buffer.length - start);
      const data = new Float32Array(length * audioChannels);
      data.set(left.subarray(start, start + length));
      data.set(right.subarray(start, start + length), length);
      const frame = new AudioData({ format: 'f32-planar', sampleRate: audioRate,
        numberOfChannels: audioChannels, numberOfFrames: length, timestamp: start / opusFrames * opusMicros, data });
      try {
        encoder.encode(frame);
      } finally {
        frame.close();
      }
    }
    // Flushing pads the final Opus packet. Flush once to retain one continuous stream.
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }

  if (!header || header.length < 19 || new TextDecoder().decode(header.subarray(0, 8)) !== 'OpusHead' ||
      !packets.length || packets.some((packet, index) => packet.ms !== index * (opusMicros / 1000) || packet.duration !== opusMicros)) {
    throw new Error('浏览器没有返回可封装的 Opus 音轨。');
  }
  const skip = new DataView(header.buffer).getUint16(10, true);
  const trim = packets.length * opusFrames - skip - buffer.length;
  if (trim < 0 || trim >= opusFrames) throw new Error('Opus 音轨的结束采样无法与画面时长对齐。');
  return {
    header, packets,
    delay: Math.round(skip / audioRate * 1e9),
    trim: Math.round(trim / audioRate * 1e9),
  };
}

function audioTrack(audio) {
  return element(0xae, integer(0xd7, 2), integer(0x73c5, 2), integer(0x83, 2),
    string(0x86, 'A_OPUS'), element(0x63a2, audio.header),
    integer(0x56aa, audio.delay), integer(0x56bb, 80_000_000),
    element(0xe1, float64(0xb5, audioRate), integer(0x9f, audioChannels)));
}

function audioBlock(packet, clusterTime, discardPadding) {
  const relative = packet.ms - clusterTime;
  const track = [0x82, relative >> 8, relative & 255];
  return discardPadding
    ? element(0xa0, element(0xa1, Uint8Array.of(...track, 0), packet.bytes),
      element(0x75a2, unsigned(discardPadding, 4)))
    : element(0xa3, Uint8Array.of(...track, 0x80), packet.bytes);
}
