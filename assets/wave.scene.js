const film = {
  title: '波峰遇见波峰',
  filename: 'wave-study.webm',
  width: 1280,
  height: 720,
  fps: 30,
  frameCount: 360,
};

const { width: W, height: H, fps: FPS } = film;
const DURATION = film.frameCount / FPS;
const paper = '#f7f0e4', ink = '#17253b', muted = '#545f6c';
const blue = '#3958cb', ember = '#ab432d', rule = '#dad1c2';
const scenes = [
  { at: 0,   title: ['先看', '一条波'], lines: ['蓝线记录每个位置的位移。', '横轴表示零位移。'] },
  { at: 3.4, title: ['让两个', '波峰对齐'], lines: ['同样的波形，起初错开。', '移动第二条波，直到峰顶重合。'] },
  { at: 8.0, title: ['位移相加', '波峰加倍'], lines: ['同一位置的位移直接相加。', '同幅同相时，峰高变成两倍。'] },
];
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;

function text(ctx, value, x, y, size, color = ink, weight = 500, family = '"Microsoft YaHei", "PingFang SC", sans-serif') {
  ctx.fillStyle = color;
  ctx.font = weight + ' ' + size + 'px ' + family;
  ctx.fillText(value, x, y);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const x0 = 528, width = 668, peakX = x0 + width * .625;
const amplitude = 37;
const wave = (p, phase = 0) => Math.sin(4 * Math.PI * p + phase);

function drawWave(ctx, y, label, color, displacement, opacity = 1, labelOffset = 57) {
  ctx.save();
  ctx.globalAlpha = opacity;
  text(ctx, label, x0, y - labelOffset, 17, color, 700);
  line(ctx, x0, y, x0 + width, y, rule);
  for (let k = 0; k <= 8; k++) {
    const x = x0 + width * k / 8;
    line(ctx, x, y - 4, x, y + 4, rule);
  }
  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  for (let j = 0; j <= width; j += 2) {
    const py = y - displacement(j / width);
    if (j === 0) ctx.moveTo(x0 + j, py);
    else ctx.lineTo(x0 + j, py);
  }
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(peakX, y - displacement(.625), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

// 唯一的动画输入是秒数。跳到任意时刻都能直接重建画面。
function drawFrame(ctx, frame) {
  const t = frame / FPS;
  const index = t >= scenes[2].at ? 2 : t >= scenes[1].at ? 1 : 0;
  const scene = scenes[index];
  const local = t - scene.at;
  const enter = ease(local / .54);
  const open = ease(t / 1.4);
  const split = ease((t - 3.4) / .64);
  const phase = Math.PI * (1 - ease((t - 4.4) / 3.0));
  const sum = ease((t - 8) / .6);
  const a = p => amplitude * wave(p) * open;
  const b = p => amplitude * wave(p, phase);
  const yA = lerp(376, 248, split);
  const yB = lerp(450, 397, sum);

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  line(ctx, 76, 105, 1196, 105, rule);
  line(ctx, 478, 137, 478, 618, rule);
  line(ctx, 76, 636, 1196, 636, rule);
  text(ctx, 'WAVE STUDIES', 76, 78, 16, muted, 700, 'Consolas, monospace');
  text(ctx, '波形叠加', 1098, 78, 16, muted, 600);
  text(ctx, '0' + (index + 1) + ' / 03', 76, 160, 15, blue, 700, 'Consolas, monospace');

  ctx.save();
  ctx.globalAlpha = .28 + .72 * enter;
  ctx.translate(0, 11 * (1 - enter));
  scene.title.forEach((value, i) => text(ctx, value, 73, 289 + i * 82, 68, ink, 700));
  scene.lines.forEach((value, i) => text(ctx, value, 77, 488 + i * 36, 23, muted));
  ctx.restore();

  drawWave(ctx, yA, '波形 A', blue, a);
  if (split > 0) drawWave(ctx, yB, '波形 B', ember, b, split);
  if (sum > 0) {
    drawWave(ctx, 548, '叠加结果', ink, p => (a(p) + b(p)) * sum, sum, 87);
    ctx.save();
    ctx.globalAlpha = sum;
    ctx.setLineDash([4, 7]);
    line(ctx, peakX, 190, peakX, 580, '#8b94aa');
    ctx.restore();
    text(ctx, '两倍峰高', peakX + 15, 461, 17, ink, 700);
  }
  line(ctx, 76, 636, 76 + 1120 * t / DURATION, 636, blue, 3);
  text(ctx, '位移  /  示意', 76, 675, 15, muted);
  text(ctx, t.toFixed(1) + ' s', 1125, 675, 16, muted, 600, 'Consolas, monospace');
}
