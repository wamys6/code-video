# code-video

[中文](#中文) · [English](#english)

## 中文

**code-video** 是一个用原生 Canvas 和 JavaScript 制作动态图解、数据动画和 2D 人物短片的技能包。Codex、腾讯 WorkBuddy 和 DeepSeek Harness 共用同一份 `SKILL.md`、脚本和示例。生成的单文件 HTML 可以离线打开，也可以逐帧导出带音轨的 WebM。

### 安装

保留整个技能目录，确保 `code-video/SKILL.md` 与 `scripts/`、`assets/`、`references/` 同级。

#### Codex

将整个仓库克隆到 Codex 的 Skills 目录下，文件夹命名为 `code-video`。默认目录是 `~/.codex/skills`。

```sh
git clone https://github.com/wamys6/code-video.git ~/.codex/skills/code-video
```

在 Codex 中用 `$code-video` 调用。

#### 腾讯 WorkBuddy

下载 [仓库 ZIP](https://github.com/wamys6/code-video/archive/refs/heads/main.zip)，解压并将包含 `SKILL.md` 的文件夹改名为 `code-video`。在桌面端打开「专家·技能·连接器 → 技能 → 添加技能 → 上传技能」，选择技能文件夹，或将该文件夹压缩为 ZIP 后上传。在新对话中请 WorkBuddy 使用 `code-video` 完成视频任务。详见 [WorkBuddy 技能文档](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)。

#### DeepSeek Harness

在项目根目录运行以下命令，然后以该项目为工作区开启会话，并请 Harness 使用 `code-video`。详见 [DeepSeek Harness 技能文档](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/skills)。

```sh
git clone https://github.com/wamys6/code-video.git .dsh/skills/code-video
```

### 运行示例

示例可在本机终端直接运行。若要由助手代为导出，其执行环境须能运行 Node.js 并启动本机的 Chromium 浏览器。命令行导出需要 Node.js 22 或以上和支持所用 WebCodecs 编码器的浏览器。Windows 上导出脚本会查找 Edge 或 Chrome。其他安装位置可将浏览器可执行文件路径作为第三个参数。

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

**code-video** is a skill for making animated explainers, data visualizations, and 2D character shorts with native Canvas and JavaScript. Codex, Tencent WorkBuddy, and DeepSeek Harness use the same `SKILL.md`, scripts, and examples. It builds a self-contained HTML preview that works offline and renders WebM frame by frame, with optional audio.

### Installation

Keep the full skill folder, with `code-video/SKILL.md` alongside `scripts/`, `assets/`, and `references/`.

#### Codex

Clone the repository into your Codex skills directory as `code-video`. The default directory is `~/.codex/skills`.

```sh
git clone https://github.com/wamys6/code-video.git ~/.codex/skills/code-video
```

Invoke `$code-video` in Codex.

#### Tencent WorkBuddy

Download the [repository ZIP](https://github.com/wamys6/code-video/archive/refs/heads/main.zip), extract it, and rename the folder containing `SKILL.md` to `code-video`. In the desktop app, go to Skills and choose Add Skill → Upload Skill. Select the skill folder or upload it as a ZIP. In a new conversation, ask WorkBuddy to use `code-video` for your video task. See the [WorkBuddy skills guide](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market).

#### DeepSeek Harness

Run the command below from the project root. Start a session with that project as its workspace and ask Harness to use `code-video`. See the [DeepSeek Harness skills guide](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/skills).

```sh
git clone https://github.com/wamys6/code-video.git .dsh/skills/code-video
```

### Run the examples

Run the examples directly from a local terminal. For an agent to export them, its execution environment needs access to Node.js and a local Chromium browser. Command-line export requires Node.js 22 or newer and a browser that supports the relevant WebCodecs encoders. On Windows the exporter looks for Edge or Chrome. For a different installation, pass the browser executable as the third argument.

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
