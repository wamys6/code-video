# code-video

[中文](#中文) · [English](#english)

## 中文

**code-video** 是一个 Codex Skill，用原生 Canvas 和 JavaScript 制作动态图解、数据动画和 2D 人物短片。生成的单文件 HTML 可以离线打开，也可以逐帧导出带音轨的 WebM。

### 安装

将整个仓库克隆到 Codex 的 Skills 目录下，文件夹命名为 `code-video`。默认目录是 `~/.codex/skills`。

```sh
git clone https://github.com/wamys6/code-video.git ~/.codex/skills/code-video
```

在 Codex 中用 `$code-video` 调用。也可以把仓库克隆到普通工作目录，直接运行下面的示例。

### 运行示例

制作端需要 Node.js 和支持所用 WebCodecs 编码器的 Chromium 浏览器。命令行导出需要 Node.js 22 或以上。Windows 上导出脚本会查找 Edge 或 Chrome。其他安装位置可将浏览器可执行文件路径作为第三个参数。

在仓库根目录运行：

```sh
node scripts/build.mjs assets/wave.scene.js preview/wave.html
node scripts/export.mjs preview/wave.html preview/wave.webm
```

也可以直接打开 `preview/wave.html`，拖动时间滑条或点击「导出 WebM」。

**有声示例《借伞》**演示走路、转身、道具交接和两句对白。口型按对白时间手工标注。

```sh
node scripts/build.mjs assets/character-dialogue.scene.js preview/umbrella.html --include assets/character-motion.js --audio offer=assets/dialogue-audio/offer.wav --audio thanks=assets/dialogue-audio/thanks.wav
node scripts/export.mjs preview/umbrella.html preview/umbrella.webm
```

### 制作自己的短片

在 `*.scene.js` 中定义影片规格 `film`，并实现 `drawFrame(ctx, frame)`。预览和导出使用同一个绘制函数。人物走姿、转身画片、道具握点和口型时间由作者设计。内置导出为 VP8 视频，可带一条混合后的 Opus 音轨。

- [Skill 入口](SKILL.md)
- [制作与验收](references/production.md)
- [人物动画](references/character-animation.md)
- [对白与音轨](references/audio.md)

## English

**code-video** is a Codex skill for making animated explainers, data visualizations, and 2D character shorts with native Canvas and JavaScript. It builds a self-contained HTML preview that works offline and renders WebM frame by frame, with optional audio.

### Installation

Clone the repository into your Codex skills directory as `code-video`. The default directory is `~/.codex/skills`.

```sh
git clone https://github.com/wamys6/code-video.git ~/.codex/skills/code-video
```

Invoke `$code-video` in Codex. You can also clone it into a regular workspace and run the examples directly.

### Run the examples

Building requires Node.js. Export requires a Chromium browser that supports the relevant WebCodecs encoders. The command-line exporter requires Node.js 22 or newer. On Windows it looks for Edge or Chrome. For a different installation, pass the browser executable as the third argument.

Run these commands from the repository root:

```sh
node scripts/build.mjs assets/wave.scene.js preview/wave.html
node scripts/export.mjs preview/wave.html preview/wave.webm
```

You can also open `preview/wave.html` directly, scrub the timeline, or click the WebM export button.

**Borrowing an Umbrella** demonstrates walking, turning, a prop handoff, and two lines of dialogue. The mouth shapes are timed by hand against the dialogue.

```sh
node scripts/build.mjs assets/character-dialogue.scene.js preview/umbrella.html --include assets/character-motion.js --audio offer=assets/dialogue-audio/offer.wav --audio thanks=assets/dialogue-audio/thanks.wav
node scripts/export.mjs preview/umbrella.html preview/umbrella.webm
```

### Make your own short

Define the `film` configuration and `drawFrame(ctx, frame)` in a `*.scene.js` file. Preview and export use the same drawing function. Author the character poses, turn views, prop contact points, and mouth timing for each shot. The built-in exporter produces VP8 video with an optional mixed Opus audio track.

- [Skill instructions](SKILL.md)
- [Production and verification guide](references/production.md)
- [Character animation guide](references/character-animation.md)
- [Dialogue and audio guide](references/audio.md)
