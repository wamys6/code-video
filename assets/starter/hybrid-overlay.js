// The anchor is in normalized device coordinates, after this frame's camera update.
export function drawCallout(ctx, anchor) {
  if (Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1 || Math.abs(anchor.z) > 1) return;
  const { width, height } = ctx.canvas;
  const x = (anchor.x + 1) * width / 2;
  const y = (1 - anchor.y) * height / 2;
  const scale = Math.min(width / 960, height / 540);
  const right = x < width * .6;
  const direction = right ? 1 : -1;
  const elbow = x + direction * 38 * scale;
  const labelY = Math.max(30 * scale, y - 38 * scale);
  const edge = elbow + direction * 112 * scale;
  ctx.save();
  ctx.strokeStyle = '#d9f4ff';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.arc(x, y, 4 * scale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + direction * 4 * scale, y);
  ctx.lineTo(elbow, labelY);
  ctx.lineTo(edge, labelY);
  ctx.stroke();
  ctx.fillStyle = '#101d2b';
  ctx.fillRect(Math.min(elbow, edge), labelY - 24 * scale, Math.abs(edge - elbow), 23 * scale);
  ctx.fillStyle = '#e8f7ff';
  ctx.font = '600 ' + 15 * scale + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Emitter cap', (elbow + edge) / 2, labelY - 7 * scale);
  ctx.restore();
}
