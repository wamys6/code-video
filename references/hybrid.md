# 把二维标注画进三维成片

进入 `assets/starter` 的工作副本，按[快速开始](quick-start.md)准备依赖。预览网址加 `?hybrid=1`，加 `&t=1.45` 可固定在某一时刻。以下命令分别验证随机定位、导出两秒短样和完整 MP4。

```sh
npm run render -- --hybrid --samples
npm run render -- --hybrid --preview
npm run render -- --hybrid
```

示例给信标顶部加上随镜头移动的引线。纯三维模式直接把 WebGL 画到输出画布。混合模式将 WebGL 画到独立画布，每次调用 `renderAt(t)`，先更新场景与相机并渲染，再把整张三维底图复制到输出画布，最后逐帧绘制二维标注。导出器与网页预览读取同一个 `#film`。调试面板和网页控件留在画面外。

在 [film.js](../assets/starter/film.js) 选择部件局部坐标作为锚点，随对象矩阵转成世界坐标，再用当前相机投影。[hybrid-overlay.js](../assets/starter/hybrid-overlay.js) 把投影坐标转换成输出像素，按实际画幅绘制文字和引线。锚点离开视锥时隐藏标注。需要表现部件被遮挡时，按具体镜头加入遮挡判断或限定标注时间。屏幕固定的字幕或图例可直接用输出像素定位。

对照纯三维和混合模式的同一帧。检查运动前后、切点两侧和回拖后的标记落点，缩小画面看文字是否清楚。最后打开编码后的文件，确认有底图也有标注。按需用 `--audio ./mix.wav` 加入已经对好时间的音轨。
