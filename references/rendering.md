# 渲染与交付

## 时间接口

场景加载完成后发布 `window.filmReady`，启动失败时则给出错误信号。提供同步或异步的 `window.renderAt(seconds)`，返回时画面已更新。导出入口（示例是 `?export=1`）关闭实时播放，视口与目标分辨率一致。

```js
for (let frame = 0; frame < frameCount; frame++) {
  const t = frame / fps
  await page.evaluate(time => window.renderAt(time), t)
  // 读取 Canvas 像素，把编码后的帧交给编码器。
}
```

成片帧号从 0 开始，最后一帧是 `(frameCount - 1) / fps`。非整数帧时长要明确取整。示例就近取整，并按实际帧时长对齐音轨。画面时间与采集耗时独立，慢 GPU 也能导出正确的播放节奏。

## 环境和导出器

- 示例使用 Node.js、Vite、Three.js、Playwright Chromium、FFmpeg 和 FFprobe。用 `npm ci` 安装锁定的依赖，用 `npx playwright install chromium` 准备浏览器。
- 导出器读取 Canvas，把图像流送进 FFmpeg，减少逐帧图片的临时磁盘占用。需要透明通道或无损图像序列时，改用匹配的格式和流程。
- 示例输出 H.264 MP4，附带音频时用 AAC。核对实际帧数、尺寸、时长和音轨。音效卡点优先对齐冲击帧或剪辑点。
- Playwright 记录异常、控制台和失败资源。FFmpeg 的 stderr 能区分编码器缺失、画幅不兼容、音频读不到和磁盘空间不足。可设置 `FILM_CHROMIUM`、`FILM_FFMPEG`、`FILM_FFPROBE` 指向本机程序。

## 检查单帧黑屏和黑块

示例导出器会在生成正式 `film.mp4` 前解码并扫描每一帧，查找突发的全黑或大面积近黑区域。它用相邻帧作参照，保持不变的黑边和持续暗场不会被视为突发故障。检测范围侧重于短暂、明显的亮度异常，低对比度损坏和画面观感仍需人工检查。

触发异常时，目录里保留 `failed-inspection.mp4` 和 `frame-inspection.json`。报告使用从 0 开始的帧号。按 `frame / fps` 重新渲染该帧和相邻帧。浏览器也异常时查场景状态、渲染目标和采集时序。浏览器结果正常时查对应的采集帧与编码输入。

可以从示例目录运行以下命令，独立检查已有文件。

```sh
node inspect-video.mjs ./candidate.mp4
node inspect-video.mjs ./candidate.mp4 --fps 30 --allow-frame 0
```

已知输入是从 0 秒开始的恒定帧率视频时，传入 `--fps` 可同时显示秒数。只豁免已确认属于剪辑意图的帧。命令支持重复的 `--allow-frame`。示例导出器在 `config.mjs` 的 `allowedBlackFrames` 读取同样的 0 基帧号。

## 从最早的失败处查起

| 现象 | 检查 |
|---|---|
| 页面打不开或加载未完成 | 用 Vite 的 HTTP 地址。查首个模块错误、模型 URL、HTTP 状态和加载失败信号。 |
| 交互预览正常，自动化黑屏 | 记录 Chromium 的 GPU 和 WebGL 信息。验证最小 WebGL 2 画面。区分浏览器启动、上下文创建和着色器编译问题。 |
| 画面缩放或裁切不符 | 核对 CSS 视口、Canvas 像素尺寸、像素比和相机宽高比。按目标实际像素渲染。 |
| 预览正常，导出的画面闪烁 | 做 A → B → A。查随机数、时间累积、资源加载、跨镜头历史和每帧重置。 |
| 短样正常，长片中断 | 查最早失败的帧和编码报错。检查输出盘、浏览器内存和编码器管道。 |
| 媒体属性不对 | 用 FFprobe 查帧数、时长、画幅和音轨。可解码的画面也可能有黑块，再运行逐帧检查。 |

官方参考 [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[Playwright 浏览器启动](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)、[FFmpeg 图像序列与图像管道](https://ffmpeg.org/ffmpeg-formats.html#image2)。
