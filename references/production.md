# 制作与验收

## 先定分镜

先列一句结论和一套贯穿全片的视觉规则。规则可包含对象用色、背景对比度、文字层级、运镜节奏和结尾停留时长。按实际镜头填写以下几列。

| 起止帧 | 要让观众看懂什么 | 开镜状态与主体 | 变化、落点与切换依据 | 字幕或声音 |
| --- | --- | --- | --- | --- |
| 0–101 | 认出一条波的位移和波峰 | 零轴、左侧一句标题 | 蓝线从零轴长出，标记点停在峰顶 | 标题说明零轴 |
| 102–239 | 理解两条波如何对齐 | 保留蓝线，加入橙色波形 | 逐步改变橙线相位，在两个波峰同横坐标时停住 | 点明对齐的位置 |
| 240–359 | 看懂位移相加 | 保留两条已对齐的波和标记点 | 在下方画出逐点和，虚线对齐三个标记，留出结尾停顿 | 同幅同相时峰高两倍 |

用源文稿或数据校验画面含义。让同一个对象贯穿提问、变化与结果。需要换机位时，让运动方向、视线或位置关系接得上。静帧先检查文字在手机大小是否清晰，再添加细节。

## 镜头接口

作者代码定义 `film` 与 `drawFrame(ctx, frame)`。像素坐标按成片尺寸设置。逐帧重画背景和可见对象。每次绘制应独立于前一帧，配对局部的 `ctx.save()` 和 `ctx.restore()`。

```js
const film = {
  title: '短片标题',
  filename: 'film.webm',
  width: 1280,
  height: 720,
  fps: 30,
  frameCount: 360,
};

function drawFrame(ctx, frame) {
  const seconds = frame / film.fps;
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, film.width, film.height);
  ctx.fillStyle = '#253c76';
  ctx.fillRect(80, 350, 60 + Math.min(seconds / 2, 1) * 500, 20);
}
```

帧号从 0 到 `frameCount - 1`，成片时长为 `frameCount / fps`。将切点写成整数帧，字幕和视觉变化使用这些切点。若需要抖动或粒子，用固定种子在启动时生成位置，或用帧号与粒子编号计算确定值。

可用 `film.prepare = async () => { ... }` 在预览前解码内嵌图片或加载字体。自包含 HTML 所需资源可用 data URL 内嵌，使用非系统字体时显式等待 `document.fonts.load()`。`film.bitrate` 可选，单位为 bit/s。

## 构建、预览与导出

以下命令在技能目录下运行。也可以替换脚本和输入输出文件为绝对路径。生成文件写入任务的工作目录。

```powershell
node scripts/build.mjs assets/wave.scene.js ./preview/wave.html
node scripts/export.mjs ./preview/wave.html ./preview/wave.webm
```

构建器使用 Node 标准库。打开生成的 HTML 时无需 Node。浏览器中的时间滑条按帧定位。按钮 **导出 WebM** 将视频下载到浏览器默认位置。

人物动画可用 `--include` 内嵌辅助绘图脚本。需要对白、配乐或音效时，可以用 `--audio 名称=文件` 内嵌本地音频。分别见 [人物动画](character-animation.md) 与 [对白与音轨](audio.md)。

后台导出脚本需要 Node 22 或更新版本和已安装的 Chromium 浏览器。在 Windows 默认查找 Edge 或 Chrome。其他环境或非默认安装位置可把浏览器可执行文件路径作为第三个参数。编码在独立的临时浏览器配置里完成。若目标文件已存在，使用新的输出名。脚本对一次编码最多等待 5 分钟，长片可按章节导出。

## 核对导出

- 看首帧、每镜转折、切点两侧和尾帧。缩小视口再看一遍字幕。同一帧反复定位时，图形位置和字幕应该一致。
- 交付视频时，实际打开或解码容器，核对分辨率、帧率、总帧数和时长。已有 ffprobe 可用时可作独立复核，它是可选的验证方式。
- 内置导出使用 WebCodecs 将每一帧编码为 VP8，再用 JavaScript 写 WebM。编码失败时先检查浏览器对当前尺寸和帧率的支持。模板会在帧数、时间戳或关键帧校验失败时报告错误。可以降低画幅或帧率再试。
- 有对白或配乐时，以声音落点定镜头时序。验收时同时核对视频帧、音轨时长和对白出现的位置。内置音轨为 Opus，MP4 需要兼容编码和对应容器。

[WebCodecs VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder) · [WebM 容器规范](https://www.webmproject.org/docs/container/)

## 二维短片交付 MP4

在最终尺寸为偶数时，以下命令将模板导出的 WebM 转为兼容常见播放器的 H.264 MP4。有音轨时一并转为 AAC。按成片分辨率绘制，保留原帧率和可编辑的场景代码。

```sh
ffmpeg -n -i preview/wave.webm -map 0:v:0 -map "0:a?" -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart preview/wave.mp4
ffprobe -v error -count_frames -show_streams preview/wave.mp4
node assets/starter/inspect-video.mjs preview/wave.mp4
```

比较转码前后的帧数、时长、画幅和有声状态，并检查字幕与动作卡点。
