// Two renderers for a 17x9 RGB frame: "street" (at the base, looking up the
// south face) and "river" (across the Charles at night). Geometry is traced by
// eye from public photos of Building 54; only the 9x17 window grid is faithful.
export const ROWS = 17, COLS = 9;

const CONCRETE = "#6d665a", CONCRETE_DARK = "#4c463d", CONCRETE_EDGE = "#8a8273";
const GLASS = "#0b0e14";

function lum(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

// Paint a lit window at rect with glow. Dark pixels read as unlit glass.
function windowRect(ctx, x, y, w, h, r, g, b) {
  const L = lum(r, g, b);
  ctx.fillStyle = GLASS;
  ctx.fillRect(x, y, w, h);
  if (L < 0.02) return;
  const col = `rgb(${r},${g},${b})`;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 1.1);
  grad.addColorStop(0, `rgba(${r},${g},${b},${0.55 * L + 0.15})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x - w, y - h, w * 3, h * 3);
  ctx.restore();
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  // soft inner highlight so it reads as glass, not paint
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(x, y, w, h * 0.12);
}

// Draw the south face into a rect (bx,by,bw,bh); taper = 0..1 narrows the top.
function drawFacade(ctx, frame, bx, by, bw, bh, taper, scale) {
  const pierFrac = 0.125;                 // blank concrete piers either side
  const topBandFrac = 0.075;              // parapet / mechanical band
  const baseBandFrac = 0.16;              // blank band + arches at the base
  const gridTop = by + bh * topBandFrac;
  const gridBottom = by + bh * (1 - baseBandFrac);
  const rowH = (gridBottom - gridTop) / ROWS;

  // width of the slab at a given y (taper toward the top)
  const widthAt = (y) => { const t = (y - by) / bh; return bw * (1 - taper * (1 - t)); };
  const leftAt = (y) => bx + (bw - widthAt(y)) / 2;

  // slab silhouette
  ctx.beginPath();
  ctx.moveTo(leftAt(by), by);
  ctx.lineTo(leftAt(by) + widthAt(by), by);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, CONCRETE_DARK); g.addColorStop(1, CONCRETE);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = CONCRETE_EDGE; ctx.lineWidth = Math.max(1, scale); ctx.stroke();

  // window grid: 9 columns, 17 rows; windows sit inside concrete mullions
  for (let r = 0; r < ROWS; r++) {
    const y0 = gridTop + r * rowH, y1 = y0 + rowH;
    const w0 = widthAt(y0), l0 = leftAt(y0);
    const gridL = l0 + w0 * pierFrac, gridW = w0 * (1 - 2 * pierFrac);
    const colW = gridW / COLS;
    for (let c = 0; c < COLS; c++) {
      const cx = gridL + c * colW;
      // mullion frame
      ctx.fillStyle = CONCRETE_DARK;
      ctx.fillRect(cx, y0, colW, rowH);
      ctx.fillStyle = CONCRETE_EDGE;
      ctx.fillRect(cx, y0, colW, Math.max(1, rowH * 0.06));
      const k = (r * COLS + c) * 3;
      const inset = colW * 0.18, top = rowH * 0.2, bot = rowH * 0.1;
      windowRect(ctx, cx + inset, y0 + top, colW - 2 * inset, rowH - top - bot, frame[k], frame[k + 1], frame[k + 2]);
    }
  }

  // arches at the base (three openings)
  const archTop = by + bh * (1 - baseBandFrac * 0.55), archH = by + bh - archTop;
  const archW = bw * 0.16, gap = bw * 0.06, startX = bx + (bw - (3 * archW + 2 * gap)) / 2;
  for (let i = 0; i < 3; i++) {
    const ax = startX + i * (archW + gap);
    ctx.fillStyle = "#05070a";
    ctx.fillRect(ax, archTop, archW, archH);
    ctx.fillStyle = "rgba(255,220,160,0.10)";
    ctx.fillRect(ax, archTop, archW, archH * 0.15);
  }

  // radome on the roof, left of centre
  const domeR = bw * 0.065, domeX = leftAt(by) + widthAt(by) * 0.3, domeY = by - domeR * 0.9;
  ctx.fillStyle = "#3a3f47"; ctx.fillRect(domeX - domeR * 0.25, by - domeR * 0.9, domeR * 0.5, domeR);
  ctx.beginPath(); ctx.arc(domeX, domeY, domeR, 0, Math.PI * 2);
  ctx.fillStyle = "#b9bcc2"; ctx.fill();
  ctx.fillStyle = "#3a3f47"; ctx.fillRect(domeX + domeR * 2.2, by - domeR * 2.2, Math.max(1, scale), domeR * 2.2); // mast
  ctx.beginPath(); ctx.arc(domeX + domeR * 2.2, by - domeR * 2.2, Math.max(1.5, scale * 1.5), 0, Math.PI * 2); ctx.fillStyle = "#ff4d4d"; ctx.fill();
}

function drawLamp(ctx, x, y, s) {
  ctx.fillStyle = "#222"; ctx.fillRect(x - s * 0.04, y - s, s * 0.08, s);
  for (const [dx, dy] of [[0, -1.05], [-0.22, -0.9], [0.22, -0.9]]) {
    const gx = x + dx * s, gy = y + dy * s;
    const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, s * 0.5);
    gr.addColorStop(0, "rgba(255,235,190,0.9)"); gr.addColorStop(1, "rgba(255,235,190,0)");
    ctx.fillStyle = gr; ctx.fillRect(gx - s * 0.5, gy - s * 0.5, s, s);
    ctx.beginPath(); ctx.arc(gx, gy, s * 0.08, 0, Math.PI * 2); ctx.fillStyle = "#fff4d6"; ctx.fill();
  }
}

export function renderStreet(ctx, frame, W, H) {
  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#050914"); sky.addColorStop(1, "#1a1c2a");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // ground / plaza
  ctx.fillStyle = "#14161a"; ctx.fillRect(0, H * 0.94, W, H * 0.06);
  ctx.fillStyle = "#132416"; ctx.fillRect(0, H * 0.96, W, H * 0.04);

  const bh = H * 0.9, bw = Math.min(W * 0.62, bh * 0.36);
  const bx = (W - bw) / 2, by = H * 0.94 - bh;
  drawFacade(ctx, frame, bx, by, bw, bh, 0.22, W / 600);
  drawLamp(ctx, bx - bw * 0.12, H * 0.94, bh * 0.09);
  drawLamp(ctx, bx + bw * 1.12, H * 0.94, bh * 0.09);
}

export function renderRiver(ctx, frame, W, H) {
  const horizon = H * 0.62;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#03060f"); sky.addColorStop(1, "#1c2236");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
  // stars
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  let seed = 7;
  for (let i = 0; i < 90; i++) { seed = (seed * 9301 + 49297) % 233280; const x = (seed / 233280) * W; seed = (seed * 9301 + 49297) % 233280; const y = (seed / 233280) * horizon * 0.8; ctx.fillRect(x, y, 1, 1); }
  // distant campus skyline
  ctx.fillStyle = "#0e1220";
  const blocks = [[0, .05, .14], [.14, .1, .08], [.22, .08, .18], [.62, .09, .12], [.72, .1, .09], [.84, .16, .11]];
  for (const [x, w, h] of blocks) ctx.fillRect(x * W, horizon - h * H, w * W, h * H);
  // MIT dome hint, right of the tower
  ctx.beginPath(); ctx.arc(W * 0.7, horizon - H * 0.03, W * 0.05, Math.PI, 0); ctx.fillStyle = "#151a2a"; ctx.fill();

  const bh = H * 0.42, bw = bh * 0.36, bx = W * 0.44 - bw / 2, by = horizon - bh;
  drawFacade(ctx, frame, bx, by, bw, bh, 0, W / 1400);

  // river with reflection
  ctx.fillStyle = "#050a14"; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.save();
  ctx.translate(0, horizon * 2); ctx.scale(1, -1);
  ctx.globalAlpha = 0.28;
  drawFacade(ctx, frame, bx, by, bw, bh, 0, W / 1400);
  ctx.restore();
  // ripple bands
  ctx.fillStyle = "rgba(5,10,20,0.55)";
  for (let y = horizon; y < H; y += 6) ctx.fillRect(0, y + ((y / 6) % 2) * 2, W, 3);
  // shoreline
  ctx.fillStyle = "#0b0f18"; ctx.fillRect(0, horizon - 2, W, 3);
}
