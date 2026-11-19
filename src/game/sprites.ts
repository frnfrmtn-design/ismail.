import {
  ArenaHazardWave,
  Bubble,
  Checkpoint,
  CollectibleItem,
  CrumblingPlatform,
  CurrentZone,
  Enemy,
  Flagpole,
  FloatingText,
  GameHUDState,
  LevelData,
  MiniBoss,
  MovingPlatform,
  Particle,
  Player,
  Projectile,
  PulleyPair,
  SceneryProp,
  TileData,
} from './types';

export const TILE_SIZE = 32;
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  camX: number,
  time: number,
  bubbles: Bubble[]
): void {
  const { theme } = level;

  if (theme === 'UNDERWATER') {
    // Deep aqua pixel ocean bands
    px(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, '#063954');
    px(ctx, 0, 0, VIEW_WIDTH, 130, '#0c5c7a');
    px(ctx, 0, 130, VIEW_WIDTH, 140, '#094966');
    // Subtle sunbeams from surface
    ctx.fillStyle = 'rgba(103, 232, 249, 0.06)';
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 220 - camX * 0.15) % (VIEW_WIDTH + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 70, 0);
      ctx.lineTo(bx + 150, VIEW_HEIGHT);
      ctx.lineTo(bx + 30, VIEW_HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    // Bubbles
    for (const b of bubbles) {
      const sx = Math.floor(b.x - camX);
      if (sx < -16 || sx > VIEW_WIDTH + 16) continue;
      px(ctx, sx - b.r, b.y - b.r, b.r * 2, b.r * 2, '#67e8f9');
      px(ctx, sx - b.r + 2, b.y - b.r + 2, Math.max(2, b.r * 2 - 4), Math.max(2, b.r * 2 - 4), '#0c5c7a');
      px(ctx, sx - b.r + 2, b.y - b.r + 2, 2, 2, '#ecfeff');
    }
  } else if (theme === 'FORTRESS') {
    px(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, '#14111c');
    px(ctx, 0, 0, VIEW_WIDTH, 220, '#1e192b');
    // Distant fortress pillars
    for (let i = 0; i < 10; i++) {
      const pxPos = ((i * 180 - camX * 0.2) % (VIEW_WIDTH + 180) + VIEW_WIDTH + 180) % (VIEW_WIDTH + 180) - 90;
      px(ctx, pxPos, 90, 36, VIEW_HEIGHT - 90, '#262038');
      px(ctx, pxPos + 4, 90, 6, VIEW_HEIGHT - 90, '#322b4a');
      // Torch glow
      const flicker = Math.sin(time * 9 + i) > 0 ? '#f97316' : '#facc15';
      px(ctx, pxPos + 14, 180, 8, 12, flicker);
      px(ctx, pxPos + 12, 192, 12, 8, '#78350f');
    }
  } else if (theme === 'SKY_MUSHROOM') {
    px(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, '#38bdf8');
    px(ctx, 0, 300, VIEW_WIDTH, VIEW_HEIGHT - 300, '#7dd3fc');
  } else {
    // Classic bright 1985 sky blue
    px(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, '#5c94fc');
    px(ctx, 0, 360, VIEW_WIDTH, VIEW_HEIGHT - 360, '#6ba4ff');
  }

  // Parallax hills & clouds for Land / Sky
  if (theme === 'LAND' || theme === 'SKY_MUSHROOM') {
    // Far clouds
    for (let i = 0; i < 12; i++) {
      const cx =
        (((i * 260 + 40 - camX * 0.22) % (VIEW_WIDTH + 240)) + VIEW_WIDTH + 240) %
          (VIEW_WIDTH + 240) -
        120;
      const cy = 72 + (i % 3) * 44;
      drawPixelCloud(ctx, cx, cy, (i % 2) + 1);
    }

    if (theme === 'LAND') {
      // Distant green hills
      for (let i = 0; i < 10; i++) {
        const hx =
          (((i * 340 - camX * 0.35) % (VIEW_WIDTH + 320)) + VIEW_WIDTH + 320) %
            (VIEW_WIDTH + 320) -
          160;
        const hHeight = i % 2 === 0 ? 96 : 64;
        drawPixelHill(ctx, hx, VIEW_HEIGHT - 64 - hHeight, 140, hHeight);
      }
    }
  }
}

function drawPixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 4 * scale;
  px(ctx, x + s, y, s * 4, s * 2, '#ffffff');
  px(ctx, x, y + s, s * 6, s * 2, '#ffffff');
  px(ctx, x + s * 2, y - s * 0.5, s * 2, s, '#ffffff');
  // Bottom shadow edge
  px(ctx, x + 2, y + s * 2.6, s * 5.8, 4, '#cbd5e1');
}

function drawPixelHill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const inset = (steps - 1 - i) * 10;
    px(ctx, x + inset, y + (i * h) / steps, w - inset * 2, h / steps + 2, '#16a34a');
    px(ctx, x + inset, y + (i * h) / steps, 8, h / steps + 2, '#22c55e');
  }
  // Hill spots
  px(ctx, x + w * 0.4, y + h * 0.4, 8, 12, '#15803d');
  px(ctx, x + w * 0.55, y + h * 0.6, 8, 12, '#15803d');
}

export function drawSceneryProp(
  ctx: CanvasRenderingContext2D,
  prop: SceneryProp,
  camX: number,
  time: number
): void {
  const sx = Math.floor(prop.x - camX);
  if (sx + prop.w < -64 || sx > VIEW_WIDTH + 64) return;

  switch (prop.kind) {
    case 'BUSH': {
      px(ctx, sx + 12, prop.y + 8, prop.w - 24, prop.h - 8, '#16a34a');
      px(ctx, sx, prop.y + 16, prop.w, prop.h - 16, '#22c55e');
      px(ctx, sx + 8, prop.y + 14, prop.w - 16, 6, '#4ade80');
      break;
    }
    case 'SEAWEED': {
      const sway = Math.round(Math.sin(time * 2.5 + prop.x * 0.05) * 4);
      const segs = Math.floor(prop.h / 16);
      for (let i = 0; i < segs; i++) {
        const segY = prop.y + prop.h - (i + 1) * 16;
        const offset = i % 2 === 0 ? sway : -sway;
        px(ctx, sx + 8 + offset, segY, 12, 16, i % 2 === 0 ? '#10b981' : '#059669');
        px(ctx, sx + 10 + offset, segY + 2, 4, 12, '#34d399');
      }
      break;
    }
    case 'CORAL': {
      const colorMain = prop.variant % 2 === 0 ? '#f43f5e' : '#fb923c';
      const colorLight = prop.variant % 2 === 0 ? '#fda4af' : '#fdba74';
      px(ctx, sx + 12, prop.y + 12, 8, prop.h - 12, colorMain);
      px(ctx, sx + 2, prop.y + 6, 10, 8, colorMain);
      px(ctx, sx + 2, prop.y, 6, 14, colorLight);
      px(ctx, sx + 20, prop.y + 10, 10, 8, colorMain);
      px(ctx, sx + 24, prop.y + 2, 6, 16, colorLight);
      break;
    }
    case 'CASTLE': {
      drawCastle(ctx, sx, prop.y, prop.w, prop.h);
      break;
    }
    default:
      break;
  }
}

function drawCastle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  // Main stone keep
  px(ctx, x, y + 48, w, h - 48, '#9ca3af');
  // Brick mortar texture
  for (let row = 0; row < (h - 48) / 16; row++) {
    const ry = y + 48 + row * 16;
    px(ctx, x, ry + 14, w, 2, '#6b7280');
    for (let col = 0; col < w / 24; col++) {
      const ox = (row % 2) * 12;
      px(ctx, x + col * 24 + ox, ry, 2, 16, '#6b7280');
    }
  }
  // Upper turret
  px(ctx, x + 28, y + 16, w - 56, 36, '#9ca3af');
  // Battlements
  for (let bx = x; bx < x + w; bx += 24) {
    px(ctx, bx, y + 36, 14, 14, '#d1d5db');
    px(ctx, bx, y + 36, 14, 4, '#f3f4f6');
  }
  for (let bx = x + 28; bx < x + w - 28; bx += 22) {
    px(ctx, bx, y + 4, 12, 14, '#d1d5db');
  }
  // Arched doorway
  const doorW = 36;
  const doorH = 56;
  const doorX = x + w / 2 - doorW / 2;
  const doorY = y + h - doorH;
  px(ctx, doorX, doorY + 12, doorW, doorH - 12, '#18181b');
  px(ctx, doorX + 6, doorY, doorW - 12, 14, '#18181b');
  // Window slits
  px(ctx, x + 20, y + 72, 12, 22, '#18181b');
  px(ctx, x + w - 32, y + 72, 12, 22, '#18181b');
  // Banner
  px(ctx, x + w / 2 - 4, y - 24, 4, 28, '#e5e7eb');
  px(ctx, x + w / 2, y - 22, 20, 12, '#dc2626');
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: TileData,
  tx: number,
  ty: number,
  camX: number,
  theme: LevelData['theme'],
  time: number
): void {
  if (tile.kind === 'EMPTY') return;

  const x = Math.floor(tx * TILE_SIZE - camX);
  const y = Math.floor(ty * TILE_SIZE + (tile.bumpOffset ?? 0));
  if (x + TILE_SIZE < -4 || x > VIEW_WIDTH + 4) return;

  const s = TILE_SIZE;

  switch (tile.kind) {
    case 'GROUND_BRICK': {
      const base = theme === 'FORTRESS' ? '#475569' : '#c25929';
      const light = theme === 'FORTRESS' ? '#64748b' : '#ea7a44';
      const dark = theme === 'FORTRESS' ? '#1e293b' : '#7c2d12';
      px(ctx, x, y, s, s, base);
      px(ctx, x, y, s, 3, light);
      px(ctx, x, y + 14, s, 2, dark);
      px(ctx, x, y + 30, s, 2, dark);
      px(ctx, x + 15, y, 2, 14, dark);
      px(ctx, x + 7, y + 16, 2, 14, dark);
      px(ctx, x + 23, y + 16, 2, 14, dark);
      break;
    }
    case 'MOSS_STONE': {
      px(ctx, x, y, s, s, '#15803d');
      px(ctx, x, y, s, 6, '#4ade80');
      px(ctx, x + 2, y + 8, s - 4, s - 10, '#166534');
      px(ctx, x + 6, y + 12, 8, 6, '#14532d');
      px(ctx, x + 18, y + 20, 10, 6, '#14532d');
      break;
    }
    case 'FLOAT_BRICK': {
      const base = theme === 'FORTRESS' ? '#64748b' : '#b45309';
      const light = theme === 'FORTRESS' ? '#94a3b8' : '#f59e0b';
      const dark = theme === 'FORTRESS' ? '#334155' : '#451a03';
      px(ctx, x, y, s, s, base);
      px(ctx, x, y, s, 2, light);
      px(ctx, x, y + 10, s, 2, dark);
      px(ctx, x, y + 20, s, 2, dark);
      px(ctx, x, y + 30, s, 2, dark);
      px(ctx, x + 15, y, 2, 10, dark);
      px(ctx, x + 7, y + 12, 2, 8, dark);
      px(ctx, x + 23, y + 12, 2, 8, dark);
      px(ctx, x + 15, y + 22, 2, 8, dark);
      break;
    }
    case 'MYSTERY': {
      const pulse = Math.floor(time * 5) % 4;
      const bodyColors = ['#eab308', '#facc15', '#fef08a', '#f59e0b'];
      const body = bodyColors[pulse];
      px(ctx, x, y, s, s, '#92400e');
      px(ctx, x + 2, y + 2, s - 4, s - 4, body);
      // Corner rivets
      px(ctx, x + 4, y + 4, 3, 3, '#78350f');
      px(ctx, x + s - 7, y + 4, 3, 3, '#78350f');
      px(ctx, x + 4, y + s - 7, 3, 3, '#78350f');
      px(ctx, x + s - 7, y + s - 7, 3, 3, '#78350f');
      // Crisp pixel '?' glyph
      const qColor = '#78350f';
      px(ctx, x + 11, y + 7, 10, 3, qColor);
      px(ctx, x + 18, y + 10, 3, 5, qColor);
      px(ctx, x + 14, y + 14, 5, 3, qColor);
      px(ctx, x + 14, y + 17, 3, 3, qColor);
      px(ctx, x + 14, y + 22, 3, 3, qColor);
      // Highlight
      px(ctx, x + 10, y + 6, 10, 3, '#ffffff');
      px(ctx, x + 17, y + 9, 3, 5, '#ffffff');
      px(ctx, x + 13, y + 13, 5, 3, '#ffffff');
      px(ctx, x + 13, y + 16, 3, 3, '#ffffff');
      px(ctx, x + 13, y + 21, 3, 3, '#ffffff');
      break;
    }
    case 'USED_BLOCK': {
      px(ctx, x, y, s, s, '#451a03');
      px(ctx, x + 2, y + 2, s - 4, s - 4, '#78350f');
      px(ctx, x + 4, y + 4, 3, 3, '#451a03');
      px(ctx, x + s - 7, y + 4, 3, 3, '#451a03');
      px(ctx, x + 4, y + s - 7, 3, 3, '#451a03');
      px(ctx, x + s - 7, y + s - 7, 3, 3, '#451a03');
      break;
    }
    case 'STONE_SOLID': {
      px(ctx, x, y, s, s, '#9ca3af');
      px(ctx, x, y, s, 3, '#e5e7eb');
      px(ctx, x, y, 3, s, '#e5e7eb');
      px(ctx, x + s - 3, y, 3, s, '#4b5563');
      px(ctx, x, y + s - 3, s, 3, '#4b5563');
      px(ctx, x + 6, y + 6, s - 12, s - 12, '#6b7280');
      break;
    }
    case 'PIPE_TOP_L': {
      px(ctx, x - 2, y, s + 2, s, '#15803d');
      px(ctx, x, y + 2, s, 4, '#4ade80');
      px(ctx, x + 4, y + 6, 8, s - 8, '#86efac');
      px(ctx, x - 2, y + s - 3, s + 2, 3, '#14532d');
      px(ctx, x - 2, y, 3, s, '#14532d');
      break;
    }
    case 'PIPE_TOP_R': {
      px(ctx, x, y, s + 2, s, '#15803d');
      px(ctx, x, y + 2, s, 4, '#4ade80');
      px(ctx, x + s - 8, y + 6, 8, s - 8, '#166534');
      px(ctx, x, y + s - 3, s + 2, 3, '#14532d');
      px(ctx, x + s - 1, y, 3, s, '#14532d');
      break;
    }
    case 'PIPE_BODY_L': {
      px(ctx, x + 2, y, s - 2, s, '#16a34a');
      px(ctx, x + 6, y, 8, s, '#86efac');
      px(ctx, x + 2, y, 3, s, '#14532d');
      break;
    }
    case 'PIPE_BODY_R': {
      px(ctx, x, y, s - 2, s, '#16a34a');
      px(ctx, x + s - 10, y, 6, s, '#15803d');
      px(ctx, x + s - 4, y, 3, s, '#14532d');
      break;
    }
    case 'MUSHROOM_STALK': {
      px(ctx, x + 6, y, s - 12, s, '#fbcfe8');
      px(ctx, x + 10, y, 6, s, '#fdf2f8');
      px(ctx, x + s - 10, y, 4, s, '#e5a9c8');
      break;
    }
    case 'MUSHROOM_CAP_L': {
      px(ctx, x + 2, y + 2, s - 2, s - 6, '#dc2626');
      px(ctx, x + 4, y, s - 4, 4, '#ef4444');
      px(ctx, x, y + 6, s, s - 12, '#dc2626');
      px(ctx, x + 2, y + s - 6, s - 2, 4, '#991b1b');
      // White spots
      px(ctx, x + 10, y + 6, 10, 10, '#ffffff');
      break;
    }
    case 'MUSHROOM_CAP_M': {
      px(ctx, x, y, s, s - 4, '#dc2626');
      px(ctx, x, y, s, 4, '#f87171');
      px(ctx, x, y + s - 6, s, 4, '#991b1b');
      // White spots
      px(ctx, x + 4, y + 8, 8, 8, '#ffffff');
      px(ctx, x + 20, y + 6, 10, 10, '#ffffff');
      break;
    }
    case 'MUSHROOM_CAP_R': {
      px(ctx, x, y + 2, s - 2, s - 6, '#dc2626');
      px(ctx, x, y, s - 4, 4, '#ef4444');
      px(ctx, x, y + 6, s, s - 12, '#dc2626');
      px(ctx, x, y + s - 6, s - 2, 4, '#991b1b');
      // White spots
      px(ctx, x + 10, y + 8, 10, 10, '#ffffff');
      break;
    }
    case 'BRIDGE_DECK': {
      px(ctx, x, y, s, 12, '#b45309');
      px(ctx, x, y, s, 3, '#f59e0b');
      px(ctx, x + 2, y + 10, s - 4, 3, '#451a03');
      // Plank dividers
      px(ctx, x + 15, y, 2, 12, '#451a03');
      // Chain rail above bridge
      px(ctx, x, y - 16, s, 3, '#94a3b8');
      px(ctx, x + 4, y - 16, 4, 3, '#cbd5e1');
      px(ctx, x + 20, y - 16, 4, 3, '#cbd5e1');
      break;
    }
    case 'BRIDGE_POST': {
      px(ctx, x + 11, y, 10, s, '#475569');
      px(ctx, x + 13, y, 3, s, '#94a3b8');
      px(ctx, x + 8, y + 2, 16, 6, '#64748b');
      break;
    }
    case 'SPIKE_FLOOR': {
      // Base plate
      px(ctx, x, y + s - 8, s, 8, '#334155');
      // 3 sharp 8-bit spikes
      for (let i = 0; i < 3; i++) {
        const sx = x + 2 + i * 10;
        px(ctx, sx, y + s - 14, 8, 6, '#94a3b8');
        px(ctx, sx + 2, y + s - 20, 4, 6, '#e2e8f0');
        px(ctx, sx + 3, y + s - 24, 2, 4, '#ef4444');
      }
      break;
    }
    case 'LAVA_POOL': {
      const wave = Math.floor(time * 5 + tx) % 2 === 0;
      if (theme === 'UNDERWATER') {
        // Abyssal thermal vent / danger trench
        px(ctx, x, y + 4, s, s - 4, '#7f1d1d');
        px(ctx, x, y + (wave ? 2 : 5), s, 6, '#ef4444');
        px(ctx, x + 4, y + (wave ? 4 : 7), 8, 3, '#fca5a5');
      } else {
        px(ctx, x, y + 4, s, s - 4, '#dc2626');
        px(ctx, x, y + (wave ? 2 : 5), s, 7, '#f97316');
        px(ctx, x + (wave ? 4 : 14), y + 4, 8, 4, '#facc15');
      }
      break;
    }
  }
}

export function drawPulley(
  ctx: CanvasRenderingContext2D,
  pulley: PulleyPair,
  camX: number
): void {
  const lx = Math.floor(pulley.left.x - camX);
  const rx = Math.floor(pulley.right.x - camX);
  const leftCenter = lx + pulley.left.w / 2;
  const rightCenter = rx + pulley.right.w / 2;

  if (rightCenter < -120 || leftCenter > VIEW_WIDTH + 120) return;

  // Overhead horizontal crossbar beam
  px(ctx, leftCenter - 6, pulley.anchorY - 6, rightCenter - leftCenter + 12, 8, '#475569');
  px(ctx, leftCenter - 6, pulley.anchorY - 6, rightCenter - leftCenter + 12, 3, '#94a3b8');

  // Pulley wheels
  for (const cx of [leftCenter, rightCenter]) {
    px(ctx, cx - 10, pulley.anchorY - 10, 20, 20, '#d97706');
    px(ctx, cx - 6, pulley.anchorY - 6, 12, 12, '#fbbf24');
    px(ctx, cx - 2, pulley.anchorY - 2, 4, 4, '#1e293b');
  }

  // Vertical chains & platforms
  for (const side of [pulley.left, pulley.right]) {
    const sx = Math.floor(side.x - camX);
    const center = sx + side.w / 2;
    for (let cy = pulley.anchorY + 8; cy < side.y; cy += 8) {
      px(ctx, center - 2, cy, 4, 5, '#cbd5e1');
      px(ctx, center - 1, cy + 5, 2, 3, '#64748b');
    }
    // Platform deck
    px(ctx, sx, side.y, side.w, side.h, '#92400e');
    px(ctx, sx, side.y, side.w, 4, '#f59e0b');
    px(ctx, sx + 4, side.y + 6, side.w - 8, 4, '#d97706');
    px(ctx, sx, side.y + side.h - 3, side.w, 3, '#451a03');
  }
}

export function drawMovingPlatform(
  ctx: CanvasRenderingContext2D,
  plat: MovingPlatform,
  camX: number
): void {
  const sx = Math.floor(plat.x - camX);
  if (sx + plat.w < -16 || sx > VIEW_WIDTH + 16) return;
  px(ctx, sx, plat.y, plat.w, plat.h, '#b45309');
  px(ctx, sx, plat.y, plat.w, 4, '#fcd34d');
  px(ctx, sx + 4, plat.y + 6, 8, 4, '#78350f');
  px(ctx, sx + plat.w - 12, plat.y + 6, 8, 4, '#78350f');
}

export function drawCrumblingPlatform(
  ctx: CanvasRenderingContext2D,
  plat: CrumblingPlatform,
  camX: number
): void {
  const sx = Math.floor(plat.x + plat.shakeX - camX);
  if (sx + plat.w < -16 || sx > VIEW_WIDTH + 16) return;

  if (plat.state === 'RESPAWNING') {
    if (plat.timer < 0.8) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, plat.baseY + 1, plat.w - 2, plat.h - 2);
    }
    return;
  }

  const isShaking = plat.state === 'SHAKING';
  const mainColor = isShaking ? '#d97706' : '#78350f';
  const topColor = isShaking ? '#fde047' : '#d97706';

  px(ctx, sx, plat.y, plat.w, plat.h, mainColor);
  px(ctx, sx, plat.y, plat.w, 4, topColor);
  // Cracks showing crumbling texture
  px(ctx, sx + 14, plat.y + 4, 2, 10, '#27272a');
  px(ctx, sx + 34, plat.y + 2, 2, 12, '#27272a');
  px(ctx, sx + plat.w - 16, plat.y + 5, 2, 9, '#27272a');
}

export function drawCurrentZone(
  ctx: CanvasRenderingContext2D,
  zone: CurrentZone,
  camX: number,
  time: number
): void {
  const sx = Math.floor(zone.x - camX);
  if (sx + zone.w < -32 || sx > VIEW_WIDTH + 32) return;

  const isWater = zone.kind === 'WATER_CURRENT';
  const dir = zone.forceX >= 0 ? 1 : -1;

  // Subtle zone tint
  ctx.fillStyle = isWater ? 'rgba(56, 189, 248, 0.12)' : 'rgba(248, 250, 252, 0.08)';
  ctx.fillRect(sx, zone.y, zone.w, zone.h);

  // Animated directional streaks
  const streakCount = Math.max(4, Math.floor(zone.w / 60));
  for (let i = 0; i < streakCount; i++) {
    const progress = ((time * (isWater ? 1.1 : 1.7) + i * 0.37) % 1);
    const localX = dir === 1 ? progress * (zone.w - 28) : (1 - progress) * (zone.w - 28);
    const localY = zone.y + 24 + ((i * 53) % Math.max(40, zone.h - 48));
    const color = isWater ? 'rgba(125, 211, 252, 0.55)' : 'rgba(255, 255, 255, 0.48)';
    px(ctx, sx + localX, localY, 24, 3, color);
    // Arrowhead
    const tipX = dir === 1 ? sx + localX + 22 : sx + localX - 2;
    px(ctx, tipX, localY - 2, 4, 7, color);
  }
}

export function drawArenaWave(
  ctx: CanvasRenderingContext2D,
  wave: ArenaHazardWave,
  camX: number,
  time: number
): void {
  if (!wave.alive) return;
  const sx = Math.floor(wave.x - camX);
  if (sx + wave.w < -32 || sx > VIEW_WIDTH + 32) return;

  if (wave.telegraphTimer > 0) {
    const flash = Math.floor(time * 16) % 2 === 0;
    px(ctx, sx, wave.y - 8, wave.w, 10, flash ? '#facc15' : '#ef4444');
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.fillText('WAVE!', sx + wave.w / 2, wave.y - 22);
    return;
  }

  const flicker = Math.floor(time * 18) % 2 === 0;
  px(ctx, sx, wave.y, wave.w, wave.h, flicker ? '#ef4444' : '#f97316');
  px(ctx, sx + 4, wave.y - 6, wave.w - 8, 8, '#facc15');
  px(ctx, sx + 8, wave.y + 4, wave.w - 16, 6, '#ffffff');
}

export function drawCheckpoint(
  ctx: CanvasRenderingContext2D,
  cp: Checkpoint,
  camX: number,
  time: number
): void {
  const sx = Math.floor(cp.x - camX);
  if (sx < -40 || sx > VIEW_WIDTH + 40) return;

  px(ctx, sx + 12, cp.y - 54, 4, 54, '#e5e7eb');
  px(ctx, sx + 10, cp.y - 58, 8, 6, '#facc15');
  const flagColor = cp.activated
    ? Math.floor(time * 6) % 2 === 0
      ? '#22c55e'
      : '#4ade80'
    : '#ef4444';
  const flagY = cp.activated ? cp.y - 52 : cp.y - 30;
  px(ctx, sx + 16, flagY, 20, 14, flagColor);
  px(ctx, sx + 18, flagY + 3, 6, 6, '#ffffff');
}

export function drawFlagpole(
  ctx: CanvasRenderingContext2D,
  flagpole: Flagpole,
  camX: number
): void {
  const sx = Math.floor(flagpole.x - camX);
  if (sx < -64 || sx > VIEW_WIDTH + 64) return;

  // Stone base
  px(ctx, sx - 12, flagpole.bottomY - 16, 28, 16, '#6b7280');
  px(ctx, sx - 10, flagpole.bottomY - 16, 24, 4, '#d1d5db');

  // Green flagpole shaft
  px(ctx, sx, flagpole.topY, 6, flagpole.bottomY - flagpole.topY - 16, '#16a34a');
  px(ctx, sx + 1, flagpole.topY, 2, flagpole.bottomY - flagpole.topY - 16, '#4ade80');

  // Gold finial ball
  px(ctx, sx - 4, flagpole.topY - 10, 14, 14, '#facc15');
  px(ctx, sx - 2, flagpole.topY - 8, 4, 4, '#fef08a');

  // Sliding pennant
  const fy = Math.floor(flagpole.flagY);
  px(ctx, sx - 32, fy, 32, 20, '#22c55e');
  px(ctx, sx - 28, fy + 4, 24, 12, '#ffffff');
  px(ctx, sx - 22, fy + 6, 10, 8, '#16a34a');
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  camX: number,
  time: number,
  inWater: boolean
): void {
  if (!player.alive) return;
  if (player.invulnTimer > 0 && Math.floor(time * 24) % 2 === 0) return;

  const sx = Math.floor(player.x - camX);
  const sy = Math.floor(player.y);
  const w = player.w;
  const h = player.h;
  const isBig = player.powerUp !== 'SMALL';

  // Color palette: Original Crimson Cap, Cobalt Overalls, Gold Buttons
  let capColor = '#dc2626';
  let capShade = '#991b1b';
  let overallColor = '#1d4ed8';
  let shirtColor = '#ef4444';
  let skinColor = '#fed7aa';
  let hairColor = '#451a03';
  let bootColor = '#78350f';
  const buttonColor = '#facc15';

  if (player.powerUp === 'FIRE') {
    capColor = '#f8fafc';
    capShade = '#cbd5e1';
    shirtColor = '#ffffff';
    overallColor = '#dc2626';
  }

  ctx.save();
  if (player.facing === -1) {
    ctx.translate(sx + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + w / 2), 0);
  }

  const stride =
    !player.onGround && !inWater
      ? 2
      : Math.abs(player.vx) > 20
      ? Math.floor(player.walkAnim) % 3
      : 0;

  if (!isBig) {
    // 24x28 crisp original adventurer
    // Cap
    px(ctx, sx + 4, sy, 16, 5, capColor);
    px(ctx, sx + 2, sy + 4, 20, 3, capShade);
    px(ctx, sx + 14, sy + 1, 4, 3, '#ffffff'); // Cap crest
    // Face & hair
    px(ctx, sx + 4, sy + 7, 14, 7, skinColor);
    px(ctx, sx + 3, sy + 7, 4, 5, hairColor);
    px(ctx, sx + 14, sy + 9, 2, 3, '#18181b'); // Eye
    px(ctx, sx + 16, sy + 11, 4, 2, skinColor); // Nose
    // Shirt & arms
    px(ctx, sx + 3, sy + 14, 18, 6, shirtColor);
    // Overalls
    px(ctx, sx + 5, sy + 15, 14, 8, overallColor);
    px(ctx, sx + 7, sy + 16, 2, 2, buttonColor);
    px(ctx, sx + 15, sy + 16, 2, 2, buttonColor);
    // Legs / boots
    if (stride === 0) {
      px(ctx, sx + 5, sy + 23, 6, 5, bootColor);
      px(ctx, sx + 13, sy + 23, 6, 5, bootColor);
    } else if (stride === 1) {
      px(ctx, sx + 3, sy + 23, 6, 5, bootColor);
      px(ctx, sx + 15, sy + 22, 6, 5, bootColor);
    } else {
      px(ctx, sx + 2, sy + 21, 7, 5, bootColor);
      px(ctx, sx + 15, sy + 23, 6, 5, bootColor);
    }
  } else {
    // 26x46 tall powered-up adventurer
    // Cap
    px(ctx, sx + 4, sy, 18, 7, capColor);
    px(ctx, sx + 2, sy + 6, 22, 4, capShade);
    px(ctx, sx + 14, sy + 2, 5, 4, '#ffffff');
    // Head
    px(ctx, sx + 5, sy + 10, 15, 11, skinColor);
    px(ctx, sx + 3, sy + 10, 5, 8, hairColor);
    px(ctx, sx + 15, sy + 12, 3, 4, '#18181b');
    px(ctx, sx + 18, sy + 15, 4, 3, skinColor);
    // Torso
    px(ctx, sx + 3, sy + 21, 20, 10, shirtColor);
    px(ctx, sx + 5, sy + 22, 16, 15, overallColor);
    // Gold buttons
    px(ctx, sx + 8, sy + 25, 3, 3, buttonColor);
    px(ctx, sx + 15, sy + 25, 3, 3, buttonColor);
    // Arms
    const armShift = stride === 1 ? 2 : stride === 2 ? -3 : 0;
    px(ctx, sx + 1, sy + 22 + armShift, 4, 9, shirtColor);
    px(ctx, sx + 1, sy + 30 + armShift, 4, 3, skinColor);
    // Legs & boots
    if (stride === 0) {
      px(ctx, sx + 5, sy + 37, 7, 9, bootColor);
      px(ctx, sx + 14, sy + 37, 7, 9, bootColor);
    } else if (stride === 1) {
      px(ctx, sx + 3, sy + 37, 7, 9, bootColor);
      px(ctx, sx + 16, sy + 35, 7, 9, bootColor);
    } else {
      px(ctx, sx + 2, sy + 34, 8, 9, bootColor);
      px(ctx, sx + 16, sy + 37, 7, 9, bootColor);
    }
  }

  ctx.restore();
}

export function drawItem(
  ctx: CanvasRenderingContext2D,
  item: CollectibleItem,
  camX: number,
  time: number
): void {
  if (item.collected) return;
  const sx = Math.floor(item.x - camX);
  const sy = Math.floor(item.y);
  if (sx + item.w < -16 || sx > VIEW_WIDTH + 16) return;

  switch (item.kind) {
    case 'COIN_POP':
    case 'WORLD_COIN': {
      const spin = Math.floor(time * 8) % 4;
      const cw = spin === 1 || spin === 3 ? 10 : spin === 2 ? 4 : 16;
      const cx = sx + (item.w - cw) / 2;
      px(ctx, cx, sy + 2, cw, item.h - 4, '#facc15');
      if (cw > 6) {
        px(ctx, cx + 3, sy + 5, cw - 6, item.h - 10, '#fef08a');
      }
      break;
    }
    case 'HEART': {
      drawPixelHeart(ctx, sx + 1, sy + 2, 22, '#ef4444');
      break;
    }
    case 'MUSHROOM': {
      px(ctx, sx + 3, sy + 2, 20, 12, '#dc2626');
      px(ctx, sx + 1, sy + 5, 24, 9, '#dc2626');
      px(ctx, sx + 5, sy + 5, 5, 5, '#ffffff');
      px(ctx, sx + 16, sy + 5, 5, 5, '#ffffff');
      px(ctx, sx + 7, sy + 14, 12, 10, '#fde68a');
      px(ctx, sx + 9, sy + 16, 2, 4, '#18181b');
      px(ctx, sx + 15, sy + 16, 2, 4, '#18181b');
      break;
    }
    case 'FIRE': {
      // Stalk & leaves
      px(ctx, sx + 11, sy + 13, 4, 11, '#16a34a');
      px(ctx, sx + 4, sy + 17, 7, 5, '#22c55e');
      px(ctx, sx + 15, sy + 17, 7, 5, '#22c55e');
      // Fiery bloom
      const flicker = Math.floor(time * 10) % 2 === 0;
      px(ctx, sx + 3, sy + 2, 20, 12, flicker ? '#ef4444' : '#f97316');
      px(ctx, sx + 6, sy + 4, 14, 8, '#facc15');
      px(ctx, sx + 9, sy + 6, 8, 4, '#ffffff');
      break;
    }
  }
}

export function drawPixelHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string = '#ef4444'
): void {
  const u = Math.max(1, Math.floor(size / 8));
  px(ctx, x + u, y, u * 2, u, color);
  px(ctx, x + u * 5, y, u * 2, u, color);
  px(ctx, x, y + u, u * 8, u * 3, color);
  px(ctx, x + u, y + u * 4, u * 6, u, color);
  px(ctx, x + u * 2, y + u * 5, u * 4, u, color);
  px(ctx, x + u * 3, y + u * 6, u * 2, u, color);
  // Highlight pixel
  px(ctx, x + u, y + u, u, u, '#fecaca');
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  camX: number,
  time: number
): void {
  if (!enemy.alive && enemy.squishTimer <= 0) return;

  const sx = Math.floor(enemy.x - camX);
  const sy = Math.floor(enemy.y);
  if (sx + enemy.w < -32 || sx > VIEW_WIDTH + 32) return;

  const isFast = enemy.variant === 'FAST';
  const isJumper = enemy.variant === 'JUMPER';

  switch (enemy.kind) {
    case 'SHROOM': {
      if (!enemy.alive) {
        const flatColor = isFast ? '#991b1b' : isJumper ? '#5b21b6' : '#92400e';
        px(ctx, sx + 2, sy + enemy.h - 8, enemy.w - 4, 8, flatColor);
        break;
      }
      // Cap
      const capTop = isFast ? '#991b1b' : isJumper ? '#5b21b6' : '#92400e';
      const capMain = isFast ? '#dc2626' : isJumper ? '#7c3aed' : '#b45309';
      px(ctx, sx + 2, sy, enemy.w - 4, 14, capTop);
      px(ctx, sx, sy + 5, enemy.w, 10, capMain);
      // Wings for Jumper variant
      if (isJumper) {
        const flap = Math.floor(time * 12) % 2;
        px(ctx, sx - 5, sy + (flap ? 4 : 7), 5, 7, '#f8fafc');
        px(ctx, sx + enemy.w, sy + (flap ? 4 : 7), 5, 7, '#f8fafc');
      }
      // Angry brows & eyes
      px(ctx, sx + 6, sy + 7, 5, 3, '#18181b');
      px(ctx, sx + enemy.w - 11, sy + 7, 5, 3, '#18181b');
      px(ctx, sx + 7, sy + 10, 4, 4, isFast ? '#facc15' : '#ffffff');
      px(ctx, sx + enemy.w - 11, sy + 10, 4, 4, isFast ? '#facc15' : '#ffffff');
      // Stem & animated feet
      px(ctx, sx + 7, sy + 15, enemy.w - 14, 7, '#fde68a');
      const step = Math.floor(time * (isFast ? 13 : 8)) % 2;
      px(ctx, sx + (step ? 2 : 5), sy + 21, 8, 5, '#451a03');
      px(ctx, sx + (step ? enemy.w - 13 : enemy.w - 10), sy + 21, 8, 5, '#451a03');
      break;
    }
    case 'TURTLE': {
      const shellDark = isFast ? '#991b1b' : isJumper ? '#3730a3' : '#15803d';
      const shellLight = isFast ? '#ef4444' : isJumper ? '#6366f1' : '#4ade80';
      if (enemy.shellState === 'IDLE_SHELL' || enemy.shellState === 'SLIDING_SHELL') {
        px(ctx, sx + 2, sy + 4, enemy.w - 4, enemy.h - 4, shellDark);
        px(ctx, sx + 6, sy + 6, enemy.w - 12, 8, shellLight);
        px(ctx, sx + 2, sy + enemy.h - 6, enemy.w - 4, 4, '#fde68a');
      } else {
        ctx.save();
        if (enemy.dir === 1) {
          ctx.translate(sx + enemy.w / 2, 0);
          ctx.scale(-1, 1);
          ctx.translate(-(sx + enemy.w / 2), 0);
        }
        // Head
        px(ctx, sx + 2, sy + 2, 10, 12, isFast ? '#fca5a5' : '#86efac');
        px(ctx, sx + 4, sy + 5, 3, 3, '#18181b');
        // Shell
        px(ctx, sx + 9, sy + 8, 17, 18, shellDark);
        px(ctx, sx + 12, sy + 10, 11, 10, shellLight);
        if (isJumper) {
          const flap = Math.floor(time * 12) % 2;
          px(ctx, sx + 14, sy + (flap ? 1 : 4), 8, 6, '#f8fafc');
        }
        // Feet
        const step = Math.floor(time * (isFast ? 12 : 7)) % 2;
        px(ctx, sx + (step ? 6 : 9), sy + 26, 7, 6, '#facc15');
        px(ctx, sx + (step ? 17 : 14), sy + 26, 7, 6, '#facc15');
        ctx.restore();
      }
      break;
    }
    case 'CHOMP_PLANT': {
      const pipeLipY = enemy.pipeBaseY ?? enemy.baseY;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx - 4, 0, enemy.w + 8, pipeLipY);
      ctx.clip();
      // Stem
      px(ctx, sx + 10, sy + 16, 8, enemy.h - 14, '#16a34a');
      // Chomping head
      const mouthOpen = Math.floor(time * 6) % 2 === 0;
      px(ctx, sx + 2, sy, enemy.w - 4, 18, '#dc2626');
      px(ctx, sx + 6, sy + 3, 4, 4, '#ffffff');
      px(ctx, sx + 18, sy + 5, 4, 4, '#ffffff');
      if (mouthOpen) {
        px(ctx, sx + 6, sy + 1, enemy.w - 12, 7, '#18181b');
        px(ctx, sx + 7, sy + 1, 3, 3, '#ffffff');
        px(ctx, sx + 16, sy + 1, 3, 3, '#ffffff');
      }
      ctx.restore();
      break;
    }
    case 'SQUID': {
      px(ctx, sx + 5, sy, enemy.w - 10, 14, isFast ? '#e0f2fe' : '#f8fafc');
      px(ctx, sx + 2, sy + 4, enemy.w - 4, 8, isFast ? '#38bdf8' : '#e2e8f0');
      px(ctx, sx + 6, sy + 7, 4, 4, isFast ? '#dc2626' : '#0f172a');
      px(ctx, sx + enemy.w - 10, sy + 7, 4, 4, isFast ? '#dc2626' : '#0f172a');
      // Pulsing tentacles
      const flare = Math.sin(time * (isFast ? 9 : 6) + enemy.x) > 0 ? 3 : 0;
      px(ctx, sx + 4 - flare, sy + 14, 4, 12, isFast ? '#7dd3fc' : '#cbd5e1');
      px(ctx, sx + 11, sy + 14, 4, 14, '#f8fafc');
      px(ctx, sx + 18 + flare, sy + 14, 4, 12, isFast ? '#7dd3fc' : '#cbd5e1');
      break;
    }
    case 'FISH': {
      ctx.save();
      if (enemy.dir === 1) {
        ctx.translate(sx + enemy.w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + enemy.w / 2), 0);
      }
      px(ctx, sx + 2, sy + 4, 18, 16, isFast ? '#f43f5e' : '#fb923c');
      px(ctx, sx + 5, sy + 2, 12, 18, isFast ? '#be123c' : '#ea580c');
      // Eye
      px(ctx, sx + 5, sy + 7, 4, 4, '#ffffff');
      px(ctx, sx + 5, sy + 8, 2, 2, '#18181b');
      // Tail & fin
      const flap = Math.floor(time * (isFast ? 14 : 10)) % 2;
      px(ctx, sx + 20, sy + (flap ? 5 : 8), 6, 10, isFast ? '#fecdd3' : '#fed7aa');
      px(ctx, sx + 11, sy + (flap ? 10 : 12), 5, 5, isFast ? '#fecdd3' : '#fed7aa');
      ctx.restore();
      break;
    }
    case 'CLOUD_DROPPER': {
      // Grumpy cloud
      px(ctx, sx + 6, sy + 2, enemy.w - 12, 14, isFast ? '#94a3b8' : '#f8fafc');
      px(ctx, sx, sy + 8, enemy.w, 14, isFast ? '#64748b' : '#ffffff');
      px(ctx, sx + 4, sy + 20, enemy.w - 8, 4, isFast ? '#475569' : '#cbd5e1');
      px(ctx, sx + 10, sy + 12, 4, 4, isFast ? '#facc15' : '#0f172a');
      px(ctx, sx + enemy.w - 14, sy + 12, 4, 4, isFast ? '#facc15' : '#0f172a');
      px(ctx, sx + 12, sy + 17, 12, 2, '#ef4444');
      break;
    }
  }
}

export function drawMiniBoss(
  ctx: CanvasRenderingContext2D,
  boss: MiniBoss,
  camX: number,
  time: number
): void {
  if (!boss.active || boss.phase === 'DEFEATED') return;
  if (boss.invulnTimer > 0 && Math.floor(time * 20) % 2 === 0) return;

  const sx = Math.floor(boss.x - camX);
  const sy = Math.floor(boss.y);
  const w = boss.w;
  const h = boss.h;
  const vulnerable = boss.phase === 'RECOVER_VULNERABLE';
  const telegraph = boss.phase === 'TELEGRAPH_FIRE' || boss.phase === 'TELEGRAPH_LEAP';

  ctx.save();
  if (boss.dir === 1) {
    ctx.translate(sx + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + w / 2), 0);
  }

  // Armored body (scales)
  const shellColor = vulnerable ? '#eab308' : telegraph ? '#f97316' : '#7c3aed';
  const bodyColor = '#15803d';
  const bellyColor = '#fde68a';

  // Spikes on top/back when NOT vulnerable
  if (!vulnerable) {
    for (let i = 0; i < 3; i++) {
      px(ctx, sx + 10 + i * 14, sy - 8, 10, 10, '#e2e8f0');
      px(ctx, sx + 13 + i * 14, sy - 12, 4, 6, '#ffffff');
    }
  } else {
    // Exposed glowing weak core on top/back!
    const pulse = Math.floor(time * 12) % 2 === 0 ? '#ef4444' : '#facc15';
    px(ctx, sx + 16, sy - 6, 24, 12, pulse);
    px(ctx, sx + 22, sy - 3, 12, 6, '#ffffff');
  }

  // Shell carapace
  px(ctx, sx + 6, sy + 4, w - 12, h - 18, shellColor);
  px(ctx, sx + 10, sy + 8, w - 20, 12, '#a78bfa');

  // Head & horns facing left (local space)
  px(ctx, sx, sy + 12, 22, 22, bodyColor);
  px(ctx, sx + 4, sy + 6, 6, 8, '#f8fafc'); // Horn
  px(ctx, sx + 5, sy + 16, 5, 5, '#ef4444'); // Glowing eye
  px(ctx, sx + 1, sy + 26, 14, 4, '#ffffff'); // Fangs

  // Belly & heavy legs
  px(ctx, sx + 14, sy + h - 22, w - 20, 12, bellyColor);
  const step = Math.floor(time * 6) % 2;
  px(ctx, sx + 8 + (step ? 0 : 4), sy + h - 12, 12, 12, bodyColor);
  px(ctx, sx + w - 22 - (step ? 0 : 4), sy + h - 12, 12, 12, bodyColor);

  ctx.restore();

  // State indicator above boss
  if (vulnerable) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = Math.floor(time * 10) % 2 === 0 ? '#facc15' : '#ffffff';
    ctx.fillText('STRIKE CORE!', sx + w / 2, sy - 18);
  } else if (telegraph) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('!', sx + w / 2, sy - 18);
  }
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: Projectile,
  camX: number,
  time: number
): void {
  if (!proj.alive) return;
  const sx = Math.floor(proj.x - camX);
  const sy = Math.floor(proj.y);
  if (sx < -24 || sx > VIEW_WIDTH + 24) return;

  if (proj.kind === 'PLAYER_FIRE') {
    const c = Math.floor(time * 16) % 2 === 0 ? '#f97316' : '#facc15';
    px(ctx, sx, sy, proj.w, proj.h, c);
    px(ctx, sx + 3, sy + 3, proj.w - 6, proj.h - 6, '#ffffff');
  } else if (proj.kind === 'BOSS_FIRE' || proj.kind === 'ARENA_FIRE') {
    const c = Math.floor(time * 12) % 2 === 0 ? '#ef4444' : '#f97316';
    px(ctx, sx, sy, proj.w, proj.h, c);
    px(ctx, sx + 4, sy + 4, proj.w - 8, proj.h - 8, '#fef08a');
  } else {
    // DROP_SPIKE from Cloud Dropper
    px(ctx, sx + 2, sy + 2, proj.w - 4, proj.h - 4, '#dc2626');
    px(ctx, sx + 6, sy - 2, 4, 4, '#f8fafc');
    px(ctx, sx + 6, sy + proj.h - 2, 4, 4, '#f8fafc');
    px(ctx, sx - 2, sy + 6, 4, 4, '#f8fafc');
    px(ctx, sx + proj.w - 2, sy + 6, 4, 4, '#f8fafc');
  }
}

export function drawParticlesAndText(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  texts: FloatingText[],
  camX: number
): void {
  for (const p of particles) {
    const sx = Math.floor(p.x - camX);
    px(ctx, sx, p.y, p.size, p.size, p.color);
  }

  ctx.font = '11px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  for (const t of texts) {
    const sx = Math.floor(t.x - camX);
    ctx.fillStyle = '#09090b';
    ctx.fillText(t.text, sx + 2, Math.floor(t.y) + 2);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, sx, Math.floor(t.y));
  }
}

export function drawTopCanvasHUD(
  ctx: CanvasRenderingContext2D,
  hud: GameHUDState,
  time: number
): void {
  // Subtle crisp top bar backdrop for 100% WCAG legibility across sky/underwater/fortress
  ctx.fillStyle = 'rgba(9, 9, 11, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, 54);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(0, 54, VIEW_WIDTH, 2);

  ctx.textBaseline = 'top';
  ctx.font = '11px "Press Start 2P", monospace';

  // LEFT: SCORE & HEARTS (up to 10 clearly)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('SCORE', 16, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(hud.score).padStart(6, '0'), 16, 26);

  // Hearts icons (10 slots) + numeric count
  const heartStartX = 128;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`HEARTS ${hud.hearts}/${hud.maxHearts}`, heartStartX, 8);
  for (let i = 0; i < hud.maxHearts; i++) {
    const hx = heartStartX + i * 16;
    if (i < hud.hearts) {
      drawPixelHeart(ctx, hx, 25, 13, '#ef4444');
    } else {
      drawPixelHeart(ctx, hx, 25, 13, '#3f3f46');
    }
  }

  // CENTER: COINS & ACTIVE POWER-UP
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`COINS x${String(hud.coins).padStart(2, '0')}`, 455, 8);

  const powerLabel =
    hud.powerUp === 'FIRE'
      ? 'FIRE BLASTER'
      : hud.powerUp === 'BIG'
      ? 'SUPER GROWTH'
      : 'NORMAL';
  ctx.fillStyle =
    hud.powerUp === 'FIRE'
      ? '#fb923c'
      : hud.powerUp === 'BIG'
      ? '#60a5fa'
      : '#cbd5e1';
  ctx.fillText(powerLabel, 455, 27);

  // RIGHT: LEVEL & 5:00 COUNTDOWN TIMER
  ctx.textAlign = 'right';
  const lvlText = hud.isEndless
    ? `ENDLESS ${hud.level}`
    : `LVL ${String(hud.level).padStart(2, '0')}/100`;
  ctx.fillStyle = hud.isBossLevel ? '#f43f5e' : '#cbd5e1';
  ctx.fillText(lvlText, VIEW_WIDTH - 104, 8);

  const secs = Math.max(0, Math.ceil(hud.timeRemaining));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const lowTime = secs <= 30;
  const flash = lowTime && Math.floor(time * 6) % 2 === 0;
  ctx.fillStyle = lowTime ? (flash ? '#ef4444' : '#fca5a5') : '#ffffff';
  ctx.fillText(`TIME ${mm}:${ss}`, VIEW_WIDTH - 104, 27);

  // BOSS HP BAR (when fighting a Mini-Boss)
  if (hud.isBossLevel && hud.bossName && hud.bossMaxHp > 0 && hud.bossHp > 0) {
    const barW = 340;
    const barH = 16;
    const bx = VIEW_WIDTH / 2 - barW / 2;
    const by = 66;
    ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
    ctx.fillRect(bx - 6, by - 20, barW + 12, barH + 26);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = hud.bossVulnerable ? '#facc15' : '#f43f5e';
    ctx.fillText(
      hud.bossVulnerable ? `${hud.bossName} - VULNERABLE!` : hud.bossName,
      VIEW_WIDTH / 2,
      by - 15
    );
    ctx.fillStyle = '#27272a';
    ctx.fillRect(bx, by, barW, barH);
    const ratio = Math.max(0, hud.bossHp / hud.bossMaxHp);
    ctx.fillStyle = hud.bossVulnerable ? '#eab308' : '#dc2626';
    ctx.fillRect(bx + 2, by + 2, Math.floor((barW - 4) * ratio), barH - 4);
  }

  // CENTER BANNER ALERT (e.g. TIME UP! -1 HEART or CHECKPOINT!)
  if (hud.bannerMessage) {
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(9, 9, 11, 0.86)';
    ctx.fillRect(VIEW_WIDTH / 2 - 250, 106, 500, 44);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW_WIDTH / 2 - 250, 106, 500, 44);
    ctx.fillStyle = '#facc15';
    ctx.fillText(hud.bannerMessage, VIEW_WIDTH / 2, 120);
  }
}
