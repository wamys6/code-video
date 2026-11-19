# 三维与混合工程快速开始

## DeepSeek Harness

把解压得到的整个 `code-video` 文件夹放到要制作视频的项目根目录下的 `.agents/skills/`。

```text
项目根目录/
└── .agents/
    └── skills/
        └── code-video/
            ├── SKILL.md
            ├── assets/
            └── references/
```

在 DeepSeek Harness 中打开该项目，然后直接发下面这段。其他支持 Agent Skills 的客户端使用各自的技能目录。仅有对话功能的界面可以读 `SKILL.md` 作指导，实际运行需要能执行工程和渲染工具的环境。[DeepSeek Harness 技能发现文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.zh.md)

```text
使用 code-video Skill，做一个 8 秒的机械花朵三维短片。
主体先从暗部展开，再露出发光的花芯。用低机位和微距切换。
先从本地代码导出三张代表帧，检查花朵轮廓、金属反光和动作连续性。
把场景做成能按时间定位的 Three.js 项目，再导出 1080p MP4 和可编辑源码。
```

## 先跑随包示例

把 `assets/starter/` 复制到新的工作目录。在该目录安装依赖和 Chromium。示例需要 Node.js 22.12 或更新版本。视频导出还需要 FFmpeg 和 FFprobe。

```sh
npm ci
npx playwright install chromium
npm run dev
```

在终端给出的本地地址看信标启动动画。网址加 `?t=2.6` 可查看固定时刻。

如果 Playwright 的浏览器下载失败，可使用机器上已有的 Chromium 系浏览器。运行导出命令前，把环境变量 `FILM_CHROMIUM` 设为浏览器可执行文件的绝对路径。Windows 上还可设置 `FILM_ANGLE=d3d11` 来选择渲染后端。

```sh
npm run render -- --samples
npm run render -- --preview
npm run render
```

样帧、两秒短样和六秒原规格成片各写入新的 `renders/` 子目录。示例自带程序几何、灯光和材质，可直接跑出画面。要配已有声音时运行 `npm run render -- --audio ./mix.wav`。依赖装好后使用本地 Chromium 和编码器，画面无需联网取素材。

导出会逐帧检查短暂黑屏和大面积黑块。需要单独扫描已有视频时，可直接运行 `node inspect-video.mjs ./candidate.mp4`。独立检查只需要 Node.js 和 FFmpeg。
