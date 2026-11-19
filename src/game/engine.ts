import { audio } from './audio';
import { generateLevel } from './levelGenerator';
import {
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  drawArenaWave,
  drawBackdrop,
  drawCheckpoint,
  drawCrumblingPlatform,
  drawCurrentZone,
  drawEnemy,
  drawFlagpole,
  drawItem,
  drawMiniBoss,
  drawMovingPlatform,
  drawParticlesAndText,
  drawPlayer,
  drawProjectile,
  drawPulley,
  drawSceneryProp,
  drawTile,
  drawTopCanvasHUD,
} from './sprites';
import {
  ArenaHazardWave,
  Bubble,
  CollectibleItem,
  Enemy,
  FloatingText,
  GameHUDState,
  GameStatus,
  InputState,
  LevelData,
  MysteryReward,
  Particle,
  Player,
  PowerUpType,
  Projectile,
  SavedRunSummary,
  TileKind,
} from './types';

const STORAGE_KEY = 'super_pixel_quest_save_v1';
const LEVEL_TIME_SECONDS = 300; // Strict 5:00 countdown
const MAX_HEARTS = 10;

interface SaveData {
  hasSavedProgress: boolean;
  level: number;
  hearts: number;
  score: number;
  coins: number;
  highScore: number;
  highestLevel?: number;
}

function loadSave(): SavedRunSummary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const highScore =
        typeof parsed.highScore === 'number' && Number.isFinite(parsed.highScore) && parsed.highScore >= 0
          ? Math.floor(parsed.highScore)
          : 0;
      const rawLevel =
        typeof parsed.level === 'number'
          ? parsed.level
          : typeof parsed.highestLevel === 'number'
          ? parsed.highestLevel
          : 1;
      const level = Number.isFinite(rawLevel) && rawLevel >= 1 ? Math.floor(rawLevel) : 1;
      const rawHearts = typeof parsed.hearts === 'number' ? parsed.hearts : 3;
      const hearts =
        Number.isFinite(rawHearts) && rawHearts >= 1
          ? Math.min(MAX_HEARTS, Math.floor(rawHearts))
          : 3;
      const score =
        typeof parsed.score === 'number' && Number.isFinite(parsed.score) && parsed.score >= 0
          ? Math.floor(parsed.score)
          : 0;
      const coins =
        typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0
          ? Math.floor(parsed.coins)
          : 0;
      const hasSavedProgress =
        typeof parsed.hasSavedProgress === 'boolean'
          ? parsed.hasSavedProgress
          : level > 1 || score > 0;

      return {
        hasSavedProgress,
        level,
        hearts,
        score,
        coins,
        highScore,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    hasSavedProgress: false,
    level: 1,
    hearts: 3,
    score: 0,
    coins: 0,
    highScore: 0,
  };
}

function writeSave(data: SavedRunSummary): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...data,
        highestLevel: data.level,
      })
    );
  } catch {
    // ignore storage errors
  }
}

function isFullSolidTile(kind: TileKind): boolean {
  return (
    kind === 'GROUND_BRICK' ||
    kind === 'FLOAT_BRICK' ||
    kind === 'MYSTERY' ||
    kind === 'USED_BLOCK' ||
    kind === 'STONE_SOLID' ||
    kind === 'MOSS_STONE' ||
    kind === 'PIPE_TOP_L' ||
    kind === 'PIPE_TOP_R' ||
    kind === 'PIPE_BODY_L' ||
    kind === 'PIPE_BODY_R'
  );
}

function isOneWayTile(kind: TileKind): boolean {
  return (
    kind === 'MUSHROOM_CAP_L' ||
    kind === 'MUSHROOM_CAP_M' ||
    kind === 'MUSHROOM_CAP_R' ||
    kind === 'BRIDGE_DECK'
  );
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export class SuperPixelQuestEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private elapsedTime: number = 0;

  private status: GameStatus = 'TITLE_MENU';
  private levelNumber: number = 1;
  private level: LevelData;
  private player: Player;

  private score: number = 0;
  private highScore: number = 0;
  private savedRun: SavedRunSummary;
  private coins: number = 0;
  private hearts: number = 3;
  private timeRemaining: number = LEVEL_TIME_SECONDS;

  private camX: number = 0;
  private bannerMessage: string | null = null;
  private bannerTimer: number = 0;
  private levelClearTimer: number = 0;
  private respawnCountdownTimer: number = 0;
  private respawnReason: string | null = null;
  private timerWasResetOnHit: boolean = false;
  private lastCountdownSec: number = 0;

  private projectiles: Projectile[] = [];
  private arenaWaves: ArenaHazardWave[] = [];
  private arenaFireTimer: number = 2.6;
  private arenaWaveTimer: number = 4.4;
  private milestoneLavaTimer: number = 2.0;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private bubbles: Bubble[] = [];

  private input: InputState = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    sprint: false,
    fire: false,
    firePressed: false,
  };

  private onHudUpdate: (hud: GameHUDState) => void;
  private lastHudEmit: number = 0;

  constructor(onHudUpdate: (hud: GameHUDState) => void) {
    this.onHudUpdate = onHudUpdate;
    const saved = loadSave();
    this.highScore = saved.highScore;
    this.savedRun = saved;
    this.level = generateLevel(saved.hasSavedProgress ? saved.level : 1);
    this.player = this.createPlayer(this.level.spawnX, this.level.spawnY, 'SMALL');
    this.initBubbles();
  }

  public attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        this.ctx = ctx;
      }
    } else {
      this.ctx = null;
    }
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.001, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    this.emitHud(true);
  }

  public stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public getSavedProgress(): SavedRunSummary {
    return { ...this.savedRun };
  }

  private persistSave(heartsOverride?: number): void {
    const nextHearts =
      heartsOverride !== undefined
        ? Math.max(1, Math.min(MAX_HEARTS, heartsOverride))
        : Math.max(1, Math.min(MAX_HEARTS, this.hearts));
    this.savedRun = {
      hasSavedProgress: true,
      level: Math.max(1, this.levelNumber),
      hearts: nextHearts,
      score: Math.max(0, this.score),
      coins: Math.max(0, this.coins),
      highScore: Math.max(this.highScore, this.score),
    };
    writeSave(this.savedRun);
  }

  public startNewGame(): void {
    audio.unlock();
    this.score = 0;
    this.coins = 0;
    this.hearts = 3;
    this.loadLevel(1, 'SMALL', true);
    this.persistSave();
    this.status = 'PLAYING';
    this.showBanner('LEVEL 01 - QUEST BEGINS!', 2.0);
    this.emitHud(true);
  }

  public continueSavedGame(): void {
    audio.unlock();
    const saved = loadSave();
    const targetLevel = Math.max(1, saved.level);
    const targetHearts = Math.max(1, Math.min(MAX_HEARTS, saved.hearts));
    this.score = Math.max(0, saved.score);
    this.coins = Math.max(0, saved.coins);
    this.hearts = targetHearts;
    this.highScore = Math.max(this.highScore, saved.highScore, this.score);
    this.loadLevel(targetLevel, 'SMALL', true);
    this.persistSave();
    this.status = 'PLAYING';
    this.showBanner(`LEVEL ${String(targetLevel).padStart(2, '0')} - CONTINUE!`, 2.0);
    this.emitHud(true);
  }

  public retryCurrentLevel(): void {
    audio.unlock();
    // Strict Zero-Heart Level Restart Rule:
    // Restart from 0% start line of THIS exact level with 3 fresh Hearts and 5:00 timer
    this.hearts = 3;
    this.loadLevel(this.levelNumber, 'SMALL', true);
    this.persistSave();
    this.status = 'PLAYING';
    this.showBanner(`RETRY LEVEL ${String(this.levelNumber).padStart(2, '0')} - 3 HEARTS`, 2.2);
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.emitHud(true);
    } else if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.status = 'TITLE_MENU';
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const muted = audio.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public setKeyInput(
    action: 'left' | 'right' | 'jump' | 'sprint' | 'fire',
    pressed: boolean
  ): void {
    if (action === 'jump' && pressed && !this.input.jump) {
      this.input.jumpPressed = true;
    }
    if (action === 'fire' && pressed && !this.input.fire) {
      this.input.firePressed = true;
    }
    this.input[action] = pressed;
  }

  private createPlayer(x: number, y: number, powerUp: PowerUpType): Player {
    const isBig = powerUp !== 'SMALL';
    return {
      x,
      y: isBig ? y - 18 : y,
      w: isBig ? 26 : 24,
      h: isBig ? 46 : 28,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      powerUp,
      invulnTimer: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      swimCooldown: 0,
      fireCooldown: 0,
      walkAnim: 0,
      alive: true,
      lastSafeX: x,
      lastSafeY: y,
      safeRecordTimer: 0,
      climbingFlag: false,
      walkingToCastle: false,
    };
  }

  private loadLevel(levelNum: number, carryPowerUp: PowerUpType, resetTimer: boolean): void {
    this.levelNumber = levelNum;
    this.level = generateLevel(levelNum);
    this.player = this.createPlayer(this.level.spawnX, this.level.spawnY, carryPowerUp);
    this.projectiles = [];
    this.arenaWaves = [];
    this.arenaFireTimer = 2.4;
    this.arenaWaveTimer = 4.2;
    this.milestoneLavaTimer = 2.0;
    this.particles = [];
    this.floatingTexts = [];
    this.camX = 0;
    this.levelClearTimer = 0;
    this.respawnCountdownTimer = 0;
    this.respawnReason = null;
    this.timerWasResetOnHit = false;
    this.lastCountdownSec = 0;
    if (resetTimer) {
      this.timeRemaining = LEVEL_TIME_SECONDS;
      audio.resetTimeWarn();
    }
    this.initBubbles();
    this.persistSave();
  }

  private initBubbles(): void {
    this.bubbles = [];
    if (this.level.theme === 'UNDERWATER') {
      for (let i = 0; i < 65; i++) {
        this.bubbles.push({
          x: Math.random() * this.level.widthPx,
          y: Math.random() * VIEW_HEIGHT,
          r: 2 + Math.floor(Math.random() * 4),
          vy: -22 - Math.random() * 28,
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private showBanner(msg: string, duration: number): void {
    this.bannerMessage = msg;
    this.bannerTimer = duration;
  }

  private addScore(points: number, x?: number, y?: number, color = '#ffffff'): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.persistSave();
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        x,
        y,
        vy: -42,
        text: `+${points}`,
        color,
        life: 0.85,
      });
    }
  }

  private addFloatingText(text: string, x: number, y: number, color = '#facc15'): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -46,
      text,
      color,
      life: 1.0,
    });
  }

  private spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 140,
    gravity = true
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (gravity ? 60 : 0),
        size: 4 + Math.floor(Math.random() * 4),
        color,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity,
      });
    }
  }

  private update(dt: number): void {
    this.elapsedTime += dt;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerMessage = null;
      }
    }

    // Update ambient bubbles even on menus
    for (const b of this.bubbles) {
      b.y += b.vy * dt;
      b.x += Math.sin(this.elapsedTime * 2 + b.wobble) * 10 * dt;
      if (b.y < 54) {
        b.y = VIEW_HEIGHT - 40;
      }
    }

    if (this.status === 'TITLE_MENU') {
      // Gentle showcase pan on title screen
      this.camX = (this.camX + 24 * dt) % Math.max(1, this.level.widthPx - VIEW_WIDTH);
      this.input.jumpPressed = false;
      this.input.firePressed = false;
      return;
    }

    if (this.status === 'PAUSED' || this.status === 'LEVEL_FAILED' || this.status === 'CAMPAIGN_VICTORY') {
      this.input.jumpPressed = false;
      this.input.firePressed = false;
      return;
    }

    if (this.status === 'HEART_COUNTDOWN') {
      this.updateParticlesAndText(dt);
      this.respawnCountdownTimer -= dt;
      const currentSec = Math.max(1, Math.ceil(this.respawnCountdownTimer));
      if (this.respawnCountdownTimer > 0 && currentSec !== this.lastCountdownSec) {
        this.lastCountdownSec = currentSec;
        audio.countdownTick(currentSec);
        this.emitHud(true);
      }
      if (this.respawnCountdownTimer <= 0) {
        this.respawnCountdownTimer = 0;
        this.respawnReason = null;
        this.timerWasResetOnHit = false;
        this.lastCountdownSec = 0;
        this.respawnAtSafePosition();
        this.status = 'PLAYING';
        audio.checkpoint();
        this.emitHud(true);
      }
      this.input.jumpPressed = false;
      this.input.firePressed = false;
      return;
    }

    if (this.status === 'LEVEL_CLEAR') {
      this.updateParticlesAndText(dt);
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        const nextLevel = this.levelNumber + 1;
        this.loadLevel(nextLevel, this.player.powerUp, true);
        this.status = 'PLAYING';
        const label =
          nextLevel > 100
            ? `ENDLESS CHAMPIONSHIP ${nextLevel}!`
            : `LEVEL ${String(nextLevel).padStart(2, '0')}${nextLevel % 2 === 0 ? ' - BOSS STAGE' : ''}`;
        this.showBanner(label, 2.2);
        this.emitHud(true);
      }
      this.input.jumpPressed = false;
      this.input.firePressed = false;
      return;
    }

    // PLAYING STATE
    // 1. Strict 5-Minute Countdown Timer
    if (!this.player.climbingFlag && !this.player.walkingToCastle) {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 30 && this.timeRemaining > 0) {
        audio.timeWarning(Math.ceil(this.timeRemaining));
      }
      if (this.timeRemaining <= 0) {
        this.handleTimeOut();
      }
    }

    // 2. Tile bump animations
    for (let y = 0; y < this.level.heightTiles; y++) {
      for (let x = 0; x < this.level.widthTiles; x++) {
        const t = this.level.tiles[y][x];
        if (t.bumpOffset !== undefined && t.bumpVel !== undefined) {
          t.bumpOffset += t.bumpVel * dt;
          t.bumpVel += 220 * dt;
          if (t.bumpOffset >= 0) {
            t.bumpOffset = undefined;
            t.bumpVel = undefined;
          }
        }
      }
    }

    // 3. Platforms, Crumbling Bridges & Pulleys
    this.updateMovingPlatforms(dt);
    this.updateCrumblingPlatforms(dt);
    this.updatePulleys(dt);

    // 4. Player
    this.updatePlayer(dt);

    // 5. Checkpoints & Boss Trigger
    this.updateCheckpointsAndBossTrigger();

    // 6. Mini-Boss & Arena Hazards
    if (this.level.boss) {
      this.updateMiniBoss(dt);
    }
    this.updateArenaHazards(dt);

    // 7. Enemies, Items, Projectiles
    this.updateItems(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticlesAndText(dt);

    // 8. Camera tracking
    this.updateCamera(dt);

    // Clear one-frame button triggers
    this.input.jumpPressed = false;
    this.input.firePressed = false;

    // Emit HUD at ~15Hz for React overlays
    if (this.elapsedTime - this.lastHudEmit > 0.066) {
      this.emitHud(false);
    }
  }

  private handleTimeOut(): void {
    audio.timeUp();
    this.hearts = Math.max(0, this.hearts - 1);

    if (this.hearts <= 0) {
      this.showBanner('TIME UP! -1 HEART', 2.4);
      this.triggerLevelFailed();
      return;
    }

    // Reset timer back to 5:00 (300s) and enter 6-second reverse countdown
    this.timeRemaining = LEVEL_TIME_SECONDS;
    audio.resetTimeWarn();
    this.persistSave();
    this.startHeartCountdown('TIME UP! -1 HEART', true);
  }

  private startHeartCountdown(reason: string, timerWasReset: boolean): void {
    this.status = 'HEART_COUNTDOWN';
    this.respawnCountdownTimer = 6.0;
    this.respawnReason = reason;
    this.timerWasResetOnHit = timerWasReset;
    this.lastCountdownSec = 6;
    audio.countdownTick(6);
    this.emitHud(true);
  }

  private triggerLevelFailed(): void {
    this.hearts = 0;
    this.player.alive = false;
    this.respawnCountdownTimer = 0;
    this.respawnReason = null;
    this.timerWasResetOnHit = false;
    // Save level retry state with 3 fresh hearts so resuming this level starts cleanly from 0%
    this.persistSave(3);
    this.status = 'LEVEL_FAILED';
    audio.gameOver();
    this.emitHud(true);
  }

  private respawnAtSafePosition(): void {
    // If inside an active mini-boss arena, keep hero safely inside the arena
    const boss = this.level.boss;
    if (boss && boss.active && boss.phase !== 'DEFEATED') {
      this.player.x = boss.arenaLeft + 24;
      this.player.y = boss.groundY - this.player.h;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.invulnTimer = 2.4;
      return;
    }

    // Prefer latest activated checkpoint, else last safe tile
    let targetX = this.level.spawnX;
    let targetY = this.level.spawnY;

    for (const cp of this.level.checkpoints) {
      if (cp.activated && cp.x >= targetX) {
        targetX = cp.x;
        targetY = cp.y - this.player.h - 4;
      }
    }

    if (this.player.lastSafeX > targetX && this.level.theme !== 'UNDERWATER') {
      targetX = this.player.lastSafeX;
      targetY = this.player.lastSafeY;
    }

    this.player.x = targetX;
    this.player.y = Math.min(targetY, VIEW_HEIGHT - 120);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invulnTimer = 2.4;
  }

  private hurtPlayer(bypassPowerUp = false): void {
    if (this.player.invulnTimer > 0) return;
    if (this.player.climbingFlag || this.player.walkingToCastle) return;

    if (!bypassPowerUp && this.player.powerUp !== 'SMALL') {
      // Shrink back to normal size instead of losing a heart
      audio.hurt();
      this.player.powerUp = 'SMALL';
      const bottom = this.player.y + this.player.h;
      this.player.w = 24;
      this.player.h = 28;
      this.player.y = bottom - this.player.h;
      this.player.invulnTimer = 2.0;
      this.player.vy = -210;
      this.spawnParticles(this.player.x + 12, this.player.y + 14, '#60a5fa', 10);
      this.emitHud(true);
      return;
    }

    // Lose 1 Heart
    audio.hurt();
    this.hearts = Math.max(0, this.hearts - 1);
    this.spawnParticles(this.player.x + 12, this.player.y + 14, '#ef4444', 14);

    if (this.hearts <= 0) {
      this.triggerLevelFailed();
      return;
    }

    this.persistSave();
    this.startHeartCountdown(
      bypassPowerUp ? 'FELL IN PIT! -1 HEART' : 'LOST 1 HEART!',
      false
    );
  }

  private updateMovingPlatforms(dt: number): void {
    for (const p of this.level.movingPlatforms) {
      const prevX = p.x;
      const prevY = p.y;
      const dist = Math.hypot(p.endX - p.startX, p.endY - p.startY) || 1;
      p.progress += (p.dir * p.speed * dt) / dist;
      if (p.progress >= 1) {
        p.progress = 1;
        p.dir = -1;
      } else if (p.progress <= 0) {
        p.progress = 0;
        p.dir = 1;
      }
      p.x = p.startX + (p.endX - p.startX) * p.progress;
      p.y = p.startY + (p.endY - p.startY) * p.progress;
      p.vx = (p.x - prevX) / dt;
      p.vy = (p.y - prevY) / dt;
    }
  }

  private updatePulleys(dt: number): void {
    for (const pulley of this.level.pulleys) {
      const prevLeftY = pulley.left.y;
      const prevRightY = pulley.right.y;

      const onLeft =
        this.player.onGround &&
        this.player.x + this.player.w > pulley.left.x + 2 &&
        this.player.x < pulley.left.x + pulley.left.w - 2 &&
        Math.abs(this.player.y + this.player.h - pulley.left.y) < 6;

      const onRight =
        this.player.onGround &&
        this.player.x + this.player.w > pulley.right.x + 2 &&
        this.player.x < pulley.right.x + pulley.right.w - 2 &&
        Math.abs(this.player.y + this.player.h - pulley.right.y) < 6;

      let targetVel = 0;
      if (onLeft && !onRight) {
        targetVel = 95;
      } else if (onRight && !onLeft) {
        targetVel = -95;
      } else {
        // Gentle counterweight spring toward neutral when unoccupied
        targetVel = -pulley.offset * 0.5;
      }

      pulley.vel += (targetVel - pulley.vel) * Math.min(1, dt * 8);
      pulley.offset += pulley.vel * dt;

      if (pulley.offset > pulley.maxTravel) {
        pulley.offset = pulley.maxTravel;
        pulley.vel = 0;
      } else if (pulley.offset < -pulley.maxTravel) {
        pulley.offset = -pulley.maxTravel;
        pulley.vel = 0;
      }

      pulley.left.y = pulley.left.baseY + pulley.offset;
      pulley.right.y = pulley.right.baseY - pulley.offset;
      pulley.left.vy = (pulley.left.y - prevLeftY) / dt;
      pulley.right.vy = (pulley.right.y - prevRightY) / dt;
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const inWater = this.level.theme === 'UNDERWATER';

    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.swimCooldown > 0) p.swimCooldown = Math.max(0, p.swimCooldown - dt);

    // Flagpole & Castle exit animation
    if (p.climbingFlag) {
      const fp = this.level.flagpole;
      p.vx = 0;
      p.x = fp.x - p.w + 4;
      if (p.y + p.h < fp.bottomY - 16) {
        p.y += 180 * dt;
        fp.flagY = Math.min(fp.bottomY - 40, fp.flagY + 180 * dt);
      } else {
        p.climbingFlag = false;
        p.walkingToCastle = true;
        p.facing = 1;
      }
      return;
    }

    if (p.walkingToCastle) {
      p.vx = 135;
      p.walkAnim += dt * 10;
      p.x += p.vx * dt;
      p.y = this.level.castleY - p.h;
      if (p.x >= this.level.castleX) {
        p.walkingToCastle = false;
        const timeBonus = Math.floor(this.timeRemaining) * 10;
        this.addScore(timeBonus, p.x, p.y - 20, '#facc15');
        this.status = 'LEVEL_CLEAR';
        this.levelClearTimer = 2.6;
        this.showBanner(`LEVEL ${String(this.levelNumber).padStart(2, '0')} CLEAR! +${timeBonus}`, 2.5);
        this.emitHud(true);
      }
      return;
    }

    // Horizontal movement (crisp ground speed, slightly slower mid-air control for precise landing)
    const groundMax = this.input.sprint ? 310 : 225;
    const airMax = this.input.sprint ? 230 : 172;
    const maxSpeed = inWater ? 190 : p.onGround ? groundMax : airMax;
    const accel = inWater ? 650 : p.onGround ? 1450 : 720;
    const friction = inWater ? 520 : p.onGround ? 1350 : 320;

    if (this.input.left && !this.input.right) {
      p.vx -= accel * dt;
      p.facing = -1;
      if (p.vx < -maxSpeed) {
        p.vx = p.onGround ? -maxSpeed : p.vx + (-maxSpeed - p.vx) * Math.min(1, dt * 10);
      }
    } else if (this.input.right && !this.input.left) {
      p.vx += accel * dt;
      p.facing = 1;
      if (p.vx > maxSpeed) {
        p.vx = p.onGround ? maxSpeed : p.vx + (maxSpeed - p.vx) * Math.min(1, dt * 10);
      }
    } else {
      if (Math.abs(p.vx) <= friction * dt) {
        p.vx = 0;
      } else {
        p.vx -= Math.sign(p.vx) * friction * dt;
      }
    }

    // Apply gentle Wind / Water Current forces when inside a current zone
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;
    for (const zone of this.level.currentZones) {
      if (
        pcx >= zone.x &&
        pcx <= zone.x + zone.w &&
        pcy >= zone.y &&
        pcy <= zone.y + zone.h
      ) {
        p.vx += zone.forceX * dt;
        p.vy += zone.forceY * dt;
        const maxDrift = maxSpeed + 85;
        if (p.vx > maxDrift) p.vx = maxDrift;
        if (p.vx < -maxDrift) p.vx = -maxDrift;
      }
    }

    if (Math.abs(p.vx) > 20) {
      p.walkAnim += dt * (Math.abs(p.vx) / 28);
    } else {
      p.walkAnim = 0;
    }

    // Jump & Buoyant Swim Physics
    if (this.input.jumpPressed) {
      p.jumpBufferTimer = 0.15;
    } else if (p.jumpBufferTimer > 0) {
      p.jumpBufferTimer -= dt;
    }

    if (p.onGround) {
      p.coyoteTimer = 0.125;
    } else if (p.coyoteTimer > 0) {
      p.coyoteTimer -= dt;
    }

    if (inWater) {
      // Gentle buoyancy gravity + upward swim strokes
      const waterGravity = 340;
      p.vy += waterGravity * dt;
      if (p.vy > 190) p.vy = 190;

      if (p.jumpBufferTimer > 0 && p.swimCooldown <= 0) {
        p.vy = -255;
        p.swimCooldown = 0.16;
        p.jumpBufferTimer = 0;
        p.onGround = false;
        audio.swim();
        this.bubbles.push({
          x: p.x + p.w / 2,
          y: p.y + 4,
          r: 3,
          vy: -45,
          wobble: Math.random() * 6,
        });
      }
      // Keep hero inside water surface
      if (p.y < 58) {
        p.y = 58;
        if (p.vy < 0) p.vy = 0;
      }
    } else {
      // Land / Sky / Fortress jump with softened rising arc & smooth variable height
      if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
        p.vy = p.powerUp === 'SMALL' ? -615 : -640;
        p.onGround = false;
        p.coyoteTimer = 0;
        p.jumpBufferTimer = 0;
        audio.jump(p.powerUp !== 'SMALL');
      }

      const risingHeld = p.vy < 0 && this.input.jump;
      const risingReleased = p.vy < 0 && !this.input.jump;
      const gravity = risingReleased ? 2550 : risingHeld ? 1080 : 1520;

      p.vy += gravity * dt;
      if (p.vy > 700) p.vy = 700;
    }

    // Fire Blaster shooting
    if (
      p.powerUp === 'FIRE' &&
      (this.input.firePressed || (this.input.fire && p.fireCooldown <= 0)) &&
      p.fireCooldown <= 0
    ) {
      const activePlayerFire = this.projectiles.filter(
        (pr) => pr.alive && pr.fromPlayer
      ).length;
      if (activePlayerFire < 3) {
        p.fireCooldown = 0.24;
        audio.fireball();
        this.projectiles.push({
          id: `pf_${this.elapsedTime}_${Math.random()}`,
          fromPlayer: true,
          kind: 'PLAYER_FIRE',
          x: p.facing === 1 ? p.x + p.w : p.x - 12,
          y: p.y + 12,
          w: 12,
          h: 12,
          vx: p.facing * 430,
          vy: 70,
          bounces: 0,
          alive: true,
          life: 2.2,
        });
      }
    }

    // Horizontal move + tile collision
    p.x += p.vx * dt;
    if (p.x < 0) {
      p.x = 0;
      p.vx = 0;
    }
    if (p.x + p.w > this.level.widthPx) {
      p.x = this.level.widthPx - p.w;
      p.vx = 0;
    }

    // Boss Arena horizontal lock while active
    const boss = this.level.boss;
    if (boss && boss.active && boss.phase !== 'DEFEATED') {
      if (p.x < boss.arenaLeft) {
        p.x = boss.arenaLeft;
        if (p.vx < 0) p.vx = 0;
      }
      if (p.x + p.w > boss.arenaRight) {
        p.x = boss.arenaRight - p.w;
        if (p.vx > 0) p.vx = 0;
      }
    }

    this.resolveHorizontalTiles(p);

    // Vertical move + tile & platform collision
    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.onGround = false;

    this.resolveVerticalTiles(p, prevBottom);
    this.resolveDynamicPlatforms(p, prevBottom, dt);
    if (this.checkHazardTiles(p)) return;

    // Record safe ground position periodically for forgiving pit/timeout respawn
    if (p.onGround) {
      p.safeRecordTimer += dt;
      if (p.safeRecordTimer >= 0.4) {
        p.safeRecordTimer = 0;
        const tileBelowX = Math.floor((p.x + p.w / 2) / TILE_SIZE);
        const tileBelowY = Math.floor((p.y + p.h + 4) / TILE_SIZE);
        const t = this.level.tiles[tileBelowY]?.[tileBelowX];
        if (
          t &&
          isFullSolidTile(t.kind) &&
          t.kind !== 'PIPE_TOP_L' &&
          t.kind !== 'PIPE_TOP_R'
        ) {
          p.lastSafeX = p.x;
          p.lastSafeY = p.y;
        }
      }
    }

    // Pit fall check
    if (p.y > VIEW_HEIGHT + 40) {
      this.hurtPlayer(true);
      return;
    }

    // Flagpole check (on boss levels, requires boss defeated first)
    const fp = this.level.flagpole;
    if (!fp.triggered && (!boss || boss.phase === 'DEFEATED')) {
      if (p.x + p.w >= fp.x - 4 && p.x <= fp.x + 16 && p.y + p.h >= fp.topY) {
        fp.triggered = true;
        p.climbingFlag = true;
        p.vx = 0;
        p.vy = 0;
        audio.flagpole();
        const heightBonus = Math.max(100, Math.floor((fp.bottomY - p.y) * 5));
        this.addScore(heightBonus, fp.x, p.y, '#4ade80');
      }
    }
  }

  private resolveHorizontalTiles(p: Player): void {
    const startTy = Math.max(0, Math.floor((p.y + 3) / TILE_SIZE));
    const endTy = Math.min(this.level.heightTiles - 1, Math.floor((p.y + p.h - 3) / TILE_SIZE));
    const startTx = Math.max(0, Math.floor(p.x / TILE_SIZE));
    const endTx = Math.min(this.level.widthTiles - 1, Math.floor((p.x + p.w) / TILE_SIZE));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = this.level.tiles[ty][tx];
        if (!isFullSolidTile(tile.kind)) continue;
        const rx = tx * TILE_SIZE;
        const ry = ty * TILE_SIZE;
        if (rectsOverlap(p.x, p.y, p.w, p.h, rx, ry, TILE_SIZE, TILE_SIZE)) {
          if (p.vx > 0) {
            p.x = rx - p.w;
            p.vx = 0;
          } else if (p.vx < 0) {
            p.x = rx + TILE_SIZE;
            p.vx = 0;
          }
        }
      }
    }
  }

  private resolveVerticalTiles(p: Player, prevBottom: number): void {
    const startTx = Math.max(0, Math.floor((p.x + 3) / TILE_SIZE));
    const endTx = Math.min(this.level.widthTiles - 1, Math.floor((p.x + p.w - 3) / TILE_SIZE));
    const startTy = Math.max(0, Math.floor(p.y / TILE_SIZE));
    const endTy = Math.min(this.level.heightTiles - 1, Math.floor((p.y + p.h) / TILE_SIZE));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = this.level.tiles[ty][tx];
        const rx = tx * TILE_SIZE;
        const ry = ty * TILE_SIZE;

        if (isOneWayTile(tile.kind)) {
          if (p.vy >= 0 && prevBottom <= ry + 10 && p.y + p.h >= ry) {
            p.y = ry - p.h;
            p.vy = 0;
            p.onGround = true;
          }
          continue;
        }

        if (!isFullSolidTile(tile.kind)) continue;

        if (rectsOverlap(p.x, p.y, p.w, p.h, rx, ry, TILE_SIZE, TILE_SIZE)) {
          if (p.vy > 0) {
            p.y = ry - p.h;
            p.vy = 0;
            p.onGround = true;
          } else if (p.vy < 0) {
            // Subtle upward corner correction when grazing block edges by <= 5px
            const overlapLeft = p.x + p.w - rx;
            const overlapRight = rx + TILE_SIZE - p.x;
            const leftTileClear = tx > 0 && !isFullSolidTile(this.level.tiles[ty][tx - 1].kind);
            const rightTileClear =
              tx < this.level.widthTiles - 1 && !isFullSolidTile(this.level.tiles[ty][tx + 1].kind);

            if (overlapLeft <= 5 && leftTileClear && tile.kind !== 'MYSTERY') {
              p.x = rx - p.w;
            } else if (overlapRight <= 5 && rightTileClear && tile.kind !== 'MYSTERY') {
              p.x = rx + TILE_SIZE;
            } else {
              p.y = ry + TILE_SIZE;
              p.vy = 0;
              this.hitBlockFromBelow(tx, ty);
            }
          }
        }
      }
    }
  }

  private resolveDynamicPlatforms(p: Player, prevBottom: number, dt: number): void {
    if (p.vy < 0) return;

    // Moving platforms
    for (const mp of this.level.movingPlatforms) {
      if (
        p.x + p.w > mp.x + 2 &&
        p.x < mp.x + mp.w - 2 &&
        prevBottom <= mp.y + 12 &&
        p.y + p.h >= mp.y
      ) {
        p.y = mp.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.x += mp.vx * dt;
      }
    }

    // Crumbling / Falling Bridges & Platforms
    for (const cp of this.level.crumblingPlatforms) {
      if (cp.state !== 'IDLE' && cp.state !== 'SHAKING') continue;
      if (
        p.x + p.w > cp.x + 2 &&
        p.x < cp.x + cp.w - 2 &&
        prevBottom <= cp.y + 12 &&
        p.y + p.h >= cp.y
      ) {
        p.y = cp.y - p.h;
        p.vy = 0;
        p.onGround = true;
        if (cp.state === 'IDLE') {
          cp.state = 'SHAKING';
          const endlessTier = Math.max(0, this.levelNumber - 100);
          cp.timer = Math.max(0.24, 0.55 - Math.min(0.3, endlessTier * 0.016));
        }
      }
    }

    // Linked Pulley Counterweight Lifts
    for (const pulley of this.level.pulleys) {
      for (const side of [pulley.left, pulley.right]) {
        if (
          p.x + p.w > side.x + 2 &&
          p.x < side.x + side.w - 2 &&
          prevBottom <= side.y + 14 &&
          p.y + p.h >= side.y
        ) {
          p.y = side.y - p.h;
          p.vy = Math.max(0, side.vy);
          p.onGround = true;
        }
      }
    }
  }

  private updateCrumblingPlatforms(dt: number): void {
    for (const cp of this.level.crumblingPlatforms) {
      if (cp.state === 'SHAKING') {
        cp.timer -= dt;
        cp.shakeX = Math.sin(this.elapsedTime * 55) * 3;
        if (cp.timer <= 0) {
          cp.state = 'FALLING';
          cp.timer = 1.1;
          cp.vy = 0;
          cp.shakeX = 0;
        }
      } else if (cp.state === 'FALLING') {
        cp.vy += 880 * dt;
        cp.y += cp.vy * dt;
        cp.timer -= dt;
        if (cp.timer <= 0 || cp.y > VIEW_HEIGHT + 40) {
          cp.state = 'RESPAWNING';
          const endlessTier = Math.max(0, this.levelNumber - 100);
          cp.timer = Math.max(1.5, 2.6 - Math.min(1.1, endlessTier * 0.04));
        }
      } else if (cp.state === 'RESPAWNING') {
        cp.timer -= dt;
        if (cp.timer <= 0) {
          cp.state = 'IDLE';
          cp.y = cp.baseY;
          cp.vy = 0;
          cp.shakeX = 0;
        }
      }
    }
  }

  private checkHazardTiles(p: Player): boolean {
    const startTx = Math.max(0, Math.floor((p.x + 4) / TILE_SIZE));
    const endTx = Math.min(this.level.widthTiles - 1, Math.floor((p.x + p.w - 4) / TILE_SIZE));
    const startTy = Math.max(0, Math.floor((p.y + 4) / TILE_SIZE));
    const endTy = Math.min(this.level.heightTiles - 1, Math.floor((p.y + p.h - 2) / TILE_SIZE));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = this.level.tiles[ty][tx];
        if (tile.kind === 'LAVA_POOL') {
          this.hurtPlayer(true);
          return true;
        }
        if (tile.kind === 'SPIKE_FLOOR') {
          const rx = tx * TILE_SIZE;
          const ry = ty * TILE_SIZE + 10;
          if (rectsOverlap(p.x + 3, p.y + 4, p.w - 6, p.h - 4, rx + 2, ry, TILE_SIZE - 4, 22)) {
            p.vy = -260;
            this.hurtPlayer(false);
            return true;
          }
        }
      }
    }
    return false;
  }

  private hitBlockFromBelow(tx: number, ty: number): void {
    const tile = this.level.tiles[ty][tx];
    const worldX = tx * TILE_SIZE;
    const worldY = ty * TILE_SIZE;

    if (tile.kind === 'MYSTERY') {
      const reward: MysteryReward = tile.reward ?? 'COIN';
      tile.kind = 'USED_BLOCK';
      tile.reward = undefined;
      tile.bumpOffset = -6;
      tile.bumpVel = 85;
      this.spawnRewardFromBlock(worldX, worldY, reward);
      return;
    }

    if (tile.kind === 'FLOAT_BRICK') {
      if (this.player.powerUp !== 'SMALL') {
        // Super Growth / Fire Blaster breaks standard brick blocks!
        tile.kind = 'EMPTY';
        audio.breakBrick();
        this.addScore(50, worldX + 16, worldY);
        this.spawnParticles(worldX + 16, worldY + 16, '#d97706', 10, 180, true);
      } else {
        tile.bumpOffset = -6;
        tile.bumpVel = 85;
        audio.bump();
      }
      return;
    }

    audio.bump();
  }

  private spawnRewardFromBlock(x: number, y: number, reward: MysteryReward): void {
    if (reward === 'COIN') {
      audio.coin();
      this.coins++;
      this.addScore(100, x + 16, y - 16, '#facc15');
      this.level.items.push({
        id: `cpop_${x}_${y}_${this.elapsedTime}`,
        kind: 'COIN_POP',
        x: x + 6,
        y: y - 24,
        w: 20,
        h: 22,
        vx: 0,
        vy: -260,
        emergeY: y,
        emerging: false,
        collected: false,
        life: 0.45,
      });
      return;
    }

    if (reward === 'TRAP_ENEMY') {
      audio.bump();
      this.addFloatingText('TRAP!', x + 16, y - 18, '#ef4444');
      this.spawnParticles(x + 16, y, '#ef4444', 8, 120, true);
      const isWater = this.level.theme === 'UNDERWATER';
      const dir: 1 | -1 = this.player.x < x ? -1 : 1;
      const endlessTier = Math.max(0, this.levelNumber - 100);
      const trapVariant =
        endlessTier > 0 ? (!isWater && Math.random() < 0.45 ? 'JUMPER' : 'FAST') : 'NORMAL';
      const speedBonus = endlessTier > 0 ? Math.min(90, endlessTier * 4) : 0;
      this.level.enemies.push({
        id: `trap_${x}_${y}_${this.elapsedTime}`,
        kind: isWater ? 'FISH' : 'SHROOM',
        variant: trapVariant,
        jumpTimer: trapVariant === 'JUMPER' ? 0.8 : 0,
        x: x + 3,
        y: y - 28,
        w: 26,
        h: 26,
        vx: dir * (75 + Math.min(50, this.levelNumber) + speedBonus),
        vy: -170,
        dir,
        alive: true,
        squishTimer: 0,
        aiTimer: 0,
        baseY: y - 28,
        animFrame: 0,
      });
      return;
    }

    audio.powerup();
    const kind =
      reward === 'HEART'
        ? 'HEART'
        : reward === 'FIRE'
        ? 'FIRE'
        : 'MUSHROOM';

    this.level.items.push({
      id: `item_${x}_${y}_${this.elapsedTime}`,
      kind,
      x: x + 3,
      y: y - 4,
      w: 26,
      h: 26,
      vx: kind === 'HEART' ? 65 : kind === 'FIRE' ? 0 : 95,
      vy: 0,
      emergeY: y - 28,
      emerging: true,
      collected: false,
      life: 9999,
    });
  }

  private updateCheckpointsAndBossTrigger(): void {
    const p = this.player;
    for (const cp of this.level.checkpoints) {
      if (!cp.activated && p.x + p.w >= cp.x) {
        cp.activated = true;
        audio.checkpoint();
        this.addFloatingText('CHECKPOINT!', cp.x + 12, cp.y - 68, '#4ade80');
      }
    }

    const boss = this.level.boss;
    if (
      boss &&
      !boss.active &&
      boss.phase !== 'DEFEATED' &&
      this.level.bossArenaGateX !== null &&
      p.x >= this.level.bossArenaGateX + 36
    ) {
      boss.active = true;
      this.showBanner(`MINI-BOSS: ${boss.name}!`, 2.2);
      this.emitHud(true);
    }
  }

  private updateItems(dt: number): void {
    const p = this.player;
    for (const item of this.level.items) {
      if (item.collected) continue;

      if (item.kind === 'COIN_POP') {
        item.y += item.vy * dt;
        item.vy += 820 * dt;
        item.life -= dt;
        if (item.life <= 0) item.collected = true;
        continue;
      }

      if (item.kind === 'WORLD_COIN') {
        if (rectsOverlap(p.x, p.y, p.w, p.h, item.x, item.y, item.w, item.h)) {
          item.collected = true;
          audio.coin();
          this.coins++;
          this.addScore(100, item.x + 10, item.y, '#facc15');
        }
        continue;
      }

      if (item.emerging) {
        item.y -= 58 * dt;
        if (item.y <= item.emergeY) {
          item.y = item.emergeY;
          item.emerging = false;
        }
      } else {
        if (item.kind !== 'FIRE') {
          item.vy += 900 * dt;
          if (item.vy > 480) item.vy = 480;

          item.x += item.vx * dt;
          if (this.checkEntityWall(item.x, item.y, item.w, item.h)) {
            item.vx = -item.vx;
            item.x += item.vx * dt * 2;
          }

          item.y += item.vy * dt;
          const floorY = this.findEntityFloor(item.x, item.y, item.w, item.h);
          if (floorY !== null && item.vy > 0) {
            item.y = floorY - item.h;
            item.vy = 0;
          }
        }
      }

      // Pickup collision
      if (rectsOverlap(p.x, p.y, p.w, p.h, item.x, item.y, item.w, item.h)) {
        item.collected = true;
        if (item.kind === 'HEART') {
          audio.heart();
          if (this.hearts < MAX_HEARTS) {
            this.hearts++;
            this.persistSave();
            this.addFloatingText('+1 HEART!', item.x + 12, item.y - 10, '#ef4444');
          } else {
            this.addScore(1000, item.x + 12, item.y - 10, '#ef4444');
          }
          this.spawnParticles(item.x + 12, item.y + 12, '#ef4444', 12);
          this.emitHud(true);
        } else if (item.kind === 'MUSHROOM') {
          audio.powerup();
          if (p.powerUp === 'SMALL') {
            p.powerUp = 'BIG';
            const bottom = p.y + p.h;
            p.w = 26;
            p.h = 46;
            p.y = bottom - p.h;
            this.addScore(1000, item.x + 12, item.y - 10, '#60a5fa');
          } else if (p.powerUp === 'BIG') {
            p.powerUp = 'FIRE';
            this.addScore(1000, item.x + 12, item.y - 10, '#fb923c');
            this.addFloatingText('FIRE BLASTER!', item.x + 12, item.y - 28, '#fb923c');
          } else {
            this.addScore(1500, item.x + 12, item.y - 10, '#facc15');
          }
          this.emitHud(true);
        } else if (item.kind === 'FIRE') {
          audio.powerup();
          if (p.powerUp === 'FIRE') {
            this.addScore(1500, item.x + 12, item.y - 10, '#facc15');
          } else {
            const wasSmall = p.powerUp === 'SMALL';
            p.powerUp = 'FIRE';
            if (wasSmall) {
              const bottom = p.y + p.h;
              p.w = 26;
              p.h = 46;
              p.y = bottom - p.h;
            }
            this.addScore(1000, item.x + 12, item.y - 10, '#fb923c');
          }
          this.emitHud(true);
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const activeLeft = this.camX - 180;
    const activeRight = this.camX + VIEW_WIDTH + 220;
    const endlessTier = Math.max(0, this.levelNumber - 100);

    for (const e of this.level.enemies) {
      if (!e.alive) {
        if (e.squishTimer > 0) e.squishTimer -= dt;
        continue;
      }

      if (e.x + e.w < activeLeft || e.x > activeRight) continue;

      if (e.kind === 'CHOMP_PLANT') {
        const plantRate = 2.1 + Math.min(2.0, endlessTier * 0.08);
        e.plantPhase = (e.plantPhase ?? 0) + dt * plantRate;
        const emerge = Math.max(0, Math.sin(e.plantPhase));
        e.y = (e.pipeBaseY ?? e.baseY) - emerge * 30;
        if (emerge > 0.12 && rectsOverlap(p.x + 1, p.y + 1, p.w - 2, p.h - 2, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
          this.hurtPlayer(false);
        }
        continue;
      }

      const isFast = e.variant === 'FAST';

      if (e.kind === 'SQUID') {
        e.aiTimer += dt * (1 + Math.min(0.65, endlessTier * 0.025));
        const cycle = e.aiTimer % 2.2;
        const dashSpeed = (75 + Math.min(95, endlessTier * 3.5)) * (isFast ? 1.25 : 1);
        if (cycle < 0.7) {
          e.vy = -125 - Math.min(55, endlessTier * 2);
          e.vx = Math.sign(p.x - e.x) * dashSpeed;
        } else {
          e.vy = 55;
          e.vx *= 0.96;
        }
        e.x += e.vx * dt;
        e.y = Math.max(66, Math.min(VIEW_HEIGHT - 96, e.y + e.vy * dt));
      } else if (e.kind === 'FISH') {
        e.aiTimer += dt * (3 + Math.min(2.2, endlessTier * 0.08));
        e.x += e.vx * dt;
        const swimAmp = 32 + Math.min(20, endlessTier * 1.0);
        e.y = e.baseY + Math.sin(e.aiTimer) * swimAmp;
        e.dir = e.vx < 0 ? -1 : 1;
      } else if (e.kind === 'CLOUD_DROPPER') {
        const targetX = p.x + Math.sin(this.elapsedTime * 1.4) * 140;
        const maxCloudSpeed = (155 + Math.min(115, endlessTier * 4.5)) * (isFast ? 1.2 : 1);
        e.vx += Math.sign(targetX - e.x) * (260 + Math.min(140, endlessTier * 6)) * dt;
        if (Math.abs(e.vx) > maxCloudSpeed) e.vx = Math.sign(e.vx) * maxCloudSpeed;
        e.x += e.vx * dt;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiTimer = Math.max(
            0.6,
            2.8 - Math.min(1.4, this.levelNumber * 0.015) - Math.min(0.8, endlessTier * 0.035)
          );
          const dropVy = 60 + Math.min(140, endlessTier * 5);
          const twinSpread = endlessTier >= 6 && Math.random() < 0.45;
          if (twinSpread) {
            for (const spreadVx of [-55, 55]) {
              this.projectiles.push({
                id: `drop_${this.elapsedTime}_${spreadVx}_${Math.random()}`,
                fromPlayer: false,
                kind: 'DROP_SPIKE',
                x: e.x + e.w / 2 - 8,
                y: e.y + e.h,
                w: 16,
                h: 16,
                vx: spreadVx,
                vy: dropVy,
                bounces: 0,
                alive: true,
                life: 4.5,
              });
            }
          } else {
            this.projectiles.push({
              id: `drop_${this.elapsedTime}_${Math.random()}`,
              fromPlayer: false,
              kind: 'DROP_SPIKE',
              x: e.x + e.w / 2 - 8,
              y: e.y + e.h,
              w: 16,
              h: 16,
              vx: 0,
              vy: dropVy,
              bounces: 0,
              alive: true,
              life: 4.5,
            });
          }
        }
      } else {
        // SHROOM & TURTLE ground patrol (plus JUMPER periodic hops in Endless)
        e.vy += 980 * dt;
        if (e.vy > 520) e.vy = 520;

        e.x += e.vx * dt;
        if (this.checkEntityWall(e.x, e.y, e.w, e.h)) {
          e.vx = -e.vx;
          e.dir = e.vx < 0 ? -1 : 1;
          e.x += e.vx * dt * 2;
        }

        e.y += e.vy * dt;
        const floorY = this.findEntityFloor(e.x, e.y, e.w, e.h);
        if (floorY !== null && e.vy >= 0) {
          e.y = floorY - e.h;
          e.vy = 0;

          // Walking turtles turn around at ledges so they patrol nicely
          if (e.kind === 'TURTLE' && e.shellState === 'WALKING') {
            const lookAheadX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
            const hasFloor = this.findEntityFloor(lookAheadX, e.y, 4, e.h);
            if (hasFloor === null) {
              e.vx = -e.vx;
              e.dir = e.vx < 0 ? -1 : 1;
            }
          }

          // JUMPER variant hops periodically
          if (
            e.variant === 'JUMPER' &&
            (e.kind === 'SHROOM' || (e.kind === 'TURTLE' && e.shellState === 'WALKING'))
          ) {
            e.jumpTimer = (e.jumpTimer ?? 1.0) - dt;
            if (e.jumpTimer <= 0) {
              e.vy = -345 - Math.min(95, endlessTier * 4);
              e.jumpTimer =
                Math.max(0.7, 1.65 - Math.min(0.85, endlessTier * 0.035)) + Math.random() * 0.5;
            }
          }
        }

        if (e.y > VIEW_HEIGHT + 60) {
          e.alive = false;
          continue;
        }

        // Sliding Turtle Shell knocks out other enemies
        if (e.kind === 'TURTLE' && e.shellState === 'SLIDING_SHELL') {
          for (const other of this.level.enemies) {
            if (other === e || !other.alive || other.kind === 'CHOMP_PLANT') continue;
            if (rectsOverlap(e.x, e.y, e.w, e.h, other.x, other.y, other.w, other.h)) {
              other.alive = false;
              this.addScore(200, other.x + 12, other.y, '#4ade80');
              this.spawnParticles(other.x + 12, other.y + 12, '#4ade80', 8);
              audio.stomp();
            }
          }
        }
      }

      // Player vs Enemy interaction
      if (rectsOverlap(p.x + 2, p.y + 2, p.w - 4, p.h - 2, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
        if (e.kind === 'TURTLE' && e.shellState === 'IDLE_SHELL') {
          // Kick stationary shell
          e.shellState = 'SLIDING_SHELL';
          e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? 360 : -360;
          e.x += Math.sign(e.vx) * 14;
          audio.kickShell();
          this.addScore(100, e.x + 12, e.y);
          continue;
        }

        const isStomping =
          p.vy > 0 &&
          p.y + p.h - p.vy * dt <= e.y + e.h * 0.6 &&
          e.kind !== 'SQUID' &&
          e.kind !== 'FISH';

        if (isStomping) {
          p.vy = -340;
          audio.stomp();
          if (e.kind === 'SHROOM') {
            e.alive = false;
            e.squishTimer = 0.35;
            this.addScore(200, e.x + 12, e.y);
          } else if (e.kind === 'TURTLE') {
            if (e.shellState === 'WALKING') {
              e.shellState = 'IDLE_SHELL';
              e.vx = 0;
              e.h = 24;
              e.y += 8;
              this.addScore(100, e.x + 12, e.y);
            } else if (e.shellState === 'SLIDING_SHELL') {
              e.shellState = 'IDLE_SHELL';
              e.vx = 0;
            }
          } else if (e.kind === 'CLOUD_DROPPER') {
            e.alive = false;
            this.addScore(400, e.x + 18, e.y);
            this.spawnParticles(e.x + 20, e.y + 12, '#ffffff', 10);
          }
        } else {
          this.hurtPlayer(false);
        }
      }
    }
  }

  private updateMiniBoss(dt: number): void {
    const boss = this.level.boss;
    if (!boss || !boss.active || boss.phase === 'DEFEATED') return;

    const p = this.player;
    if (boss.invulnTimer > 0) boss.invulnTimer -= dt;

    boss.phaseTimer -= dt;
    const facingPlayer: 1 | -1 = p.x + p.w / 2 < boss.x + boss.w / 2 ? -1 : 1;

    switch (boss.phase) {
      case 'PATROL': {
        boss.dir = facingPlayer;
        boss.x += boss.vx * dt;
        if (boss.x <= boss.arenaLeft + 16) {
          boss.x = boss.arenaLeft + 16;
          boss.vx = Math.abs(boss.vx);
        } else if (boss.x + boss.w >= boss.arenaRight - 16) {
          boss.x = boss.arenaRight - 16 - boss.w;
          boss.vx = -Math.abs(boss.vx);
        }
        if (boss.phaseTimer <= 0) {
          boss.phase = Math.random() < 0.5 ? 'TELEGRAPH_FIRE' : 'TELEGRAPH_LEAP';
          boss.phaseTimer = Math.max(0.38, 0.65 / boss.speedScale);
          boss.dir = facingPlayer;
        }
        break;
      }
      case 'TELEGRAPH_FIRE': {
        boss.dir = facingPlayer;
        if (boss.phaseTimer <= 0) {
          audio.fireball();
          const shots =
            this.levelNumber >= 110
              ? 4
              : this.levelNumber > 100
              ? 3
              : this.levelNumber >= 6
              ? 2
              : 1;
          for (let s = 0; s < shots; s++) {
            this.projectiles.push({
              id: `bf_${this.elapsedTime}_${s}`,
              fromPlayer: false,
              kind: 'BOSS_FIRE',
              x: boss.dir === 1 ? boss.x + boss.w : boss.x - 16,
              y: boss.y + 20 - s * 14,
              w: 16,
              h: 16,
              vx: boss.dir * (230 * boss.speedScale),
              vy: s === 0 ? 0 : -65 * s,
              bounces: 0,
              alive: true,
              life: 3.5,
            });
          }
          boss.phase = 'TELEGRAPH_LEAP';
          boss.phaseTimer = Math.max(0.28, 0.55 / boss.speedScale);
        }
        break;
      }
      case 'TELEGRAPH_LEAP': {
        boss.dir = facingPlayer;
        if (boss.phaseTimer <= 0) {
          boss.phase = 'LEAPING';
          boss.onGround = false;
          boss.vy = -560;
          boss.vx = boss.dir * (245 * boss.speedScale);
        }
        break;
      }
      case 'LEAPING': {
        boss.vy += 1200 * dt;
        boss.x += boss.vx * dt;
        boss.y += boss.vy * dt;

        if (boss.x <= boss.arenaLeft + 8) {
          boss.x = boss.arenaLeft + 8;
          boss.vx = Math.abs(boss.vx) * 0.5;
        } else if (boss.x + boss.w >= boss.arenaRight - 8) {
          boss.x = boss.arenaRight - 8 - boss.w;
          boss.vx = -Math.abs(boss.vx) * 0.5;
        }

        if (boss.y + boss.h >= boss.groundY) {
          boss.y = boss.groundY - boss.h;
          boss.vy = 0;
          boss.vx = 0;
          boss.onGround = true;
          // Slam shockwave opens weak core for recovery!
          audio.bump();
          this.spawnParticles(boss.x + boss.w / 2, boss.groundY, '#facc15', 10, 160, false);
          boss.phase = 'RECOVER_VULNERABLE';
          const endlessBossTier =
            this.levelNumber > 100 ? Math.floor((this.levelNumber - 100) / 2) : 0;
          boss.phaseTimer =
            this.levelNumber <= 100
              ? Math.max(1.55, 2.5 - this.levelNumber * 0.01)
              : Math.max(0.95, 1.55 - endlessBossTier * 0.04);
        }
        break;
      }
      case 'RECOVER_VULNERABLE': {
        // Boss rests with exposed golden core on top/back!
        if (boss.phaseTimer <= 0) {
          boss.phase = 'PATROL';
          boss.vx = facingPlayer * 95 * boss.speedScale;
          boss.phaseTimer = Math.max(0.9, 1.6 / boss.speedScale);
        }
        break;
      }
      case 'HURT': {
        if (boss.phaseTimer <= 0) {
          boss.phase = 'PATROL';
          boss.vx = facingPlayer * 115 * boss.speedScale;
          boss.phaseTimer = Math.max(0.8, 1.4 / boss.speedScale);
        }
        break;
      }
      default:
        break;
    }

    // Player vs Mini-Boss interaction
    if (rectsOverlap(p.x + 2, p.y + 2, p.w - 4, p.h - 2, boss.x + 4, boss.y, boss.w - 8, boss.h)) {
      const stompingTop = p.vy > 0 && p.y + p.h - p.vy * dt <= boss.y + 22;

      if (boss.phase === 'RECOVER_VULNERABLE' && stompingTop) {
        p.vy = -380;
        this.damageMiniBoss(1);
      } else if (stompingTop && boss.phase !== 'RECOVER_VULNERABLE') {
        // Armored spikes bounce hero back!
        p.vy = -310;
        p.vx = p.x + p.w / 2 < boss.x + boss.w / 2 ? -220 : 220;
        audio.bump();
        this.addFloatingText('ARMORED!', boss.x + boss.w / 2, boss.y - 16, '#cbd5e1');
      } else {
        this.hurtPlayer(false);
      }
    }
  }

  private damageMiniBoss(amount: number): void {
    const boss = this.level.boss;
    if (!boss || boss.invulnTimer > 0 || boss.phase === 'DEFEATED') return;

    boss.hp = Math.max(0, boss.hp - amount);
    boss.invulnTimer = 0.45;
    audio.bossHit();
    this.spawnParticles(boss.x + boss.w / 2, boss.y + 12, '#facc15', 14, 210, true);
    this.addFloatingText('-1 HP', boss.x + boss.w / 2, boss.y - 14, '#facc15');

    if (boss.hp <= 0) {
      boss.phase = 'DEFEATED';
      boss.active = false;
      this.arenaWaves = [];
      audio.bossDefeat();
      const bonus = 2000 * Math.floor(this.levelNumber / 2);
      this.addScore(bonus, boss.x + boss.w / 2, boss.y, '#4ade80');
      this.spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#f97316', 28, 280, true);
      this.showBanner(`${boss.name} DEFEATED! HEAD TO FLAG!`, 2.4);
      this.emitHud(true);
    } else {
      boss.phase = 'HURT';
      boss.phaseTimer = 0.35;
      this.emitHud(true);
    }
  }

  private updateArenaHazards(dt: number): void {
    const p = this.player;
    const boss = this.level.boss;

    // 1. Mini-Boss Arena Periodic Fireballs & Floor Hazard Waves (every 2nd level)
    const endlessTier = Math.max(0, this.levelNumber - 100);
    const endlessBossTier = this.levelNumber > 100 ? Math.floor((this.levelNumber - 100) / 2) : 0;

    if (boss && boss.active && boss.phase !== 'DEFEATED') {
      const bossTier = Math.max(1, Math.floor(this.levelNumber / 2));

      this.arenaFireTimer -= dt;
      if (this.arenaFireTimer <= 0) {
        this.arenaFireTimer =
          this.levelNumber <= 100
            ? Math.max(1.8, 3.6 - bossTier * 0.1)
            : Math.max(0.85, 1.8 - endlessBossTier * 0.07);
        const dualSides = endlessBossTier >= 3 || (endlessBossTier >= 1 && Math.random() < 0.45);
        const sides = dualSides ? [true, false] : [Math.random() < 0.5];
        audio.fireball();
        for (const fromLeft of sides) {
          const spawnX = fromLeft ? boss.arenaLeft + 12 : boss.arenaRight - 28;
          this.projectiles.push({
            id: `af_${this.elapsedTime}_${fromLeft ? 'L' : 'R'}_${Math.random()}`,
            fromPlayer: false,
            kind: 'ARENA_FIRE',
            x: spawnX,
            y: boss.groundY - 24,
            w: 16,
            h: 16,
            vx: (fromLeft ? 1 : -1) * (175 + Math.min(180, bossTier * 6 + endlessBossTier * 12)),
            vy: -360 - Math.min(80, endlessBossTier * 6),
            bounces: 0,
            alive: true,
            life: 4.0,
          });
        }
      }

      this.arenaWaveTimer -= dt;
      if (this.arenaWaveTimer <= 0) {
        this.arenaWaveTimer =
          this.levelNumber <= 100
            ? Math.max(2.7, 5.2 - bossTier * 0.14)
            : Math.max(1.25, 2.7 - endlessBossTier * 0.09);
        const fromLeft = p.x > (boss.arenaLeft + boss.arenaRight) / 2;
        this.arenaWaves.push({
          id: `wave_${this.elapsedTime}`,
          x: fromLeft ? boss.arenaLeft + 8 : boss.arenaRight - 36,
          y: boss.groundY - 14,
          w: 28,
          h: 14,
          vx: (fromLeft ? 1 : -1) * (205 * boss.speedScale),
          telegraphTimer: Math.max(0.45, 0.7 - endlessBossTier * 0.015),
          alive: true,
        });
      }
    }

    // 2. Milestone / Boss / Endless stage periodic lava trench fireball eruptions
    if (this.levelNumber % 5 === 0 || this.level.isBossLevel || endlessTier > 0) {
      this.milestoneLavaTimer -= dt;
      if (this.milestoneLavaTimer <= 0) {
        this.milestoneLavaTimer =
          endlessTier > 0
            ? Math.max(0.7, 1.6 - endlessTier * 0.04)
            : Math.max(1.6, 2.8 - this.levelNumber * 0.01);
        const startTx = Math.max(0, Math.floor(this.camX / TILE_SIZE));
        const endTx = Math.min(
          this.level.widthTiles - 1,
          Math.ceil((this.camX + VIEW_WIDTH) / TILE_SIZE)
        );
        const lavaCols: number[] = [];
        const lavaRow = this.level.heightTiles - 2;
        for (let tx = startTx; tx <= endTx; tx++) {
          if (this.level.tiles[lavaRow]?.[tx]?.kind === 'LAVA_POOL') {
            lavaCols.push(tx);
          }
        }
        if (lavaCols.length > 0) {
          const pickTx = lavaCols[Math.floor(Math.random() * lavaCols.length)];
          this.projectiles.push({
            id: `lv_${this.elapsedTime}`,
            fromPlayer: false,
            kind: 'ARENA_FIRE',
            x: pickTx * TILE_SIZE + 8,
            y: lavaRow * TILE_SIZE - 8,
            w: 16,
            h: 16,
            vx: (Math.random() - 0.5) * 70,
            vy: -430,
            bounces: 0,
            alive: true,
            life: 3.0,
          });
        }
      }
    }

    // Update active floor hazard waves
    for (const wave of this.arenaWaves) {
      if (!wave.alive) continue;
      if (wave.telegraphTimer > 0) {
        wave.telegraphTimer -= dt;
        continue;
      }
      wave.x += wave.vx * dt;
      if (
        boss &&
        (wave.x < boss.arenaLeft - 10 || wave.x + wave.w > boss.arenaRight + 10)
      ) {
        wave.alive = false;
        continue;
      }
      if (
        rectsOverlap(
          p.x + 3,
          p.y + 3,
          p.w - 6,
          p.h - 4,
          wave.x + 2,
          wave.y + 2,
          wave.w - 4,
          wave.h - 2
        )
      ) {
        wave.alive = false;
        this.hurtPlayer(false);
      }
    }
    this.arenaWaves = this.arenaWaves.filter((w) => w.alive);
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.alive = false;
        continue;
      }

      if (pr.kind === 'PLAYER_FIRE') {
        pr.vy += 980 * dt;
        pr.x += pr.vx * dt;
        if (this.checkEntityWall(pr.x, pr.y, pr.w, pr.h)) {
          pr.alive = false;
          this.spawnParticles(pr.x, pr.y, '#fb923c', 6);
          continue;
        }
        pr.y += pr.vy * dt;
        const floorY = this.findEntityFloor(pr.x, pr.y, pr.w, pr.h);
        if (floorY !== null && pr.vy > 0) {
          pr.y = floorY - pr.h;
          pr.vy = -270;
          pr.bounces++;
          if (pr.bounces > 5) pr.alive = false;
        }

        // Hit enemies
        for (const e of this.level.enemies) {
          if (!e.alive) continue;
          if (rectsOverlap(pr.x, pr.y, pr.w, pr.h, e.x, e.y, e.w, e.h)) {
            pr.alive = false;
            e.alive = false;
            audio.stomp();
            this.addScore(200, e.x + 12, e.y, '#fb923c');
            this.spawnParticles(e.x + 12, e.y + 12, '#fb923c', 8);
            break;
          }
        }

        // Hit Mini-Boss (only hurts when vulnerable!)
        const boss = this.level.boss;
        if (
          pr.alive &&
          boss &&
          boss.active &&
          boss.phase !== 'DEFEATED' &&
          rectsOverlap(pr.x, pr.y, pr.w, pr.h, boss.x, boss.y, boss.w, boss.h)
        ) {
          pr.alive = false;
          if (boss.phase === 'RECOVER_VULNERABLE') {
            this.damageMiniBoss(1);
          } else {
            audio.bump();
            this.spawnParticles(pr.x, pr.y, '#cbd5e1', 5, 100, false);
          }
        }
      } else if (pr.kind === 'BOSS_FIRE') {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (rectsOverlap(pr.x, pr.y, pr.w, pr.h, p.x + 3, p.y + 3, p.w - 6, p.h - 6)) {
          pr.alive = false;
          this.hurtPlayer(false);
        }
      } else if (pr.kind === 'ARENA_FIRE') {
        pr.vy += 460 * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.y > VIEW_HEIGHT + 24) {
          pr.alive = false;
          continue;
        }
        if (rectsOverlap(pr.x, pr.y, pr.w, pr.h, p.x + 3, p.y + 3, p.w - 6, p.h - 6)) {
          pr.alive = false;
          this.hurtPlayer(false);
        }
      } else if (pr.kind === 'DROP_SPIKE') {
        pr.vy += 420 * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (this.findEntityFloor(pr.x, pr.y, pr.w, pr.h) !== null) {
          pr.alive = false;
          this.spawnParticles(pr.x + 8, pr.y + 8, '#ef4444', 6);
          continue;
        }
        if (rectsOverlap(pr.x, pr.y, pr.w, pr.h, p.x + 2, p.y + 2, p.w - 4, p.h - 4)) {
          pr.alive = false;
          this.hurtPlayer(false);
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.alive);
  }

  private checkEntityWall(x: number, y: number, w: number, h: number): boolean {
    const startTx = Math.max(0, Math.floor(x / TILE_SIZE));
    const endTx = Math.min(this.level.widthTiles - 1, Math.floor((x + w) / TILE_SIZE));
    const startTy = Math.max(0, Math.floor((y + 2) / TILE_SIZE));
    const endTy = Math.min(this.level.heightTiles - 1, Math.floor((y + h - 4) / TILE_SIZE));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = this.level.tiles[ty][tx];
        if (isFullSolidTile(tile.kind)) return true;
      }
    }
    return false;
  }

  private findEntityFloor(x: number, y: number, w: number, h: number): number | null {
    const startTx = Math.max(0, Math.floor((x + 2) / TILE_SIZE));
    const endTx = Math.min(this.level.widthTiles - 1, Math.floor((x + w - 2) / TILE_SIZE));
    const bottomTy = Math.floor((y + h) / TILE_SIZE);

    if (bottomTy < 0 || bottomTy >= this.level.heightTiles) return null;

    for (let tx = startTx; tx <= endTx; tx++) {
      const tile = this.level.tiles[bottomTy][tx];
      if (isFullSolidTile(tile.kind) || isOneWayTile(tile.kind)) {
        const tileTop = bottomTy * TILE_SIZE;
        if (y + h >= tileTop && y + h <= tileTop + 20) {
          return tileTop;
        }
      }
    }
    return null;
  }

  private updateParticlesAndText(dt: number): void {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.gravity) pt.vy += 650 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    for (const ft of this.floatingTexts) {
      ft.y += ft.vy * dt;
      ft.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);
  }

  private updateCamera(dt: number): void {
    const targetX = Math.max(
      0,
      Math.min(this.level.widthPx - VIEW_WIDTH, this.player.x - VIEW_WIDTH * 0.36)
    );
    this.camX += (targetX - this.camX) * Math.min(1, dt * 10);
  }

  private emitHud(force: boolean): void {
    if (force) this.lastHudEmit = this.elapsedTime;
    else this.lastHudEmit = this.elapsedTime;

    const boss = this.level.boss;
    const hud = this.buildHudState();
    // Ensure boss bar reflects live state
    if (boss && boss.active && boss.phase !== 'DEFEATED') {
      hud.bossName = boss.name;
      hud.bossHp = boss.hp;
      hud.bossMaxHp = boss.maxHp;
      hud.bossVulnerable = boss.phase === 'RECOVER_VULNERABLE';
    }
    this.onHudUpdate(hud);
  }

  private buildHudState(): GameHUDState {
    const boss = this.level.boss;
    const bossActive = !!(boss && boss.active && boss.phase !== 'DEFEATED');
    return {
      status: this.status,
      level: this.levelNumber,
      isEndless: this.levelNumber > 100,
      theme: this.level.theme,
      score: this.score,
      highScore: this.highScore,
      coins: this.coins,
      hearts: this.hearts,
      maxHearts: MAX_HEARTS,
      timeRemaining: this.timeRemaining,
      powerUp: this.player.powerUp,
      isBossLevel: this.level.isBossLevel,
      bossName: bossActive && boss ? boss.name : null,
      bossHp: bossActive && boss ? boss.hp : 0,
      bossMaxHp: bossActive && boss ? boss.maxHp : 0,
      bossVulnerable: !!(bossActive && boss && boss.phase === 'RECOVER_VULNERABLE'),
      bannerMessage: this.bannerMessage,
      respawnCountdown:
        this.status === 'HEART_COUNTDOWN'
          ? Math.max(1, Math.ceil(this.respawnCountdownTimer))
          : 0,
      respawnReason: this.respawnReason,
      timerWasReset: this.timerWasResetOnHit,
      levelProgressPct: Math.min(
        100,
        Math.max(0, Math.round((this.player.x / Math.max(1, this.level.flagpole.x)) * 100))
      ),
      muted: audio.isMuted(),
      savedRun: { ...this.savedRun },
    };
  }

  private render(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    drawBackdrop(ctx, this.level, this.camX, this.elapsedTime, this.bubbles);

    for (const prop of this.level.scenery) {
      drawSceneryProp(ctx, prop, this.camX, this.elapsedTime);
    }

    // Visible tile range
    const startTx = Math.max(0, Math.floor(this.camX / TILE_SIZE) - 1);
    const endTx = Math.min(
      this.level.widthTiles - 1,
      Math.ceil((this.camX + VIEW_WIDTH) / TILE_SIZE) + 1
    );

    for (let ty = 0; ty < this.level.heightTiles; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        drawTile(
          ctx,
          this.level.tiles[ty][tx],
          tx,
          ty,
          this.camX,
          this.level.theme,
          this.elapsedTime
        );
      }
    }

    for (const zone of this.level.currentZones) {
      drawCurrentZone(ctx, zone, this.camX, this.elapsedTime);
    }

    for (const pulley of this.level.pulleys) {
      drawPulley(ctx, pulley, this.camX);
    }

    for (const mp of this.level.movingPlatforms) {
      drawMovingPlatform(ctx, mp, this.camX);
    }

    for (const cpPlat of this.level.crumblingPlatforms) {
      drawCrumblingPlatform(ctx, cpPlat, this.camX);
    }

    for (const cp of this.level.checkpoints) {
      drawCheckpoint(ctx, cp, this.camX, this.elapsedTime);
    }

    drawFlagpole(ctx, this.level.flagpole, this.camX);

    for (const item of this.level.items) {
      drawItem(ctx, item, this.camX, this.elapsedTime);
    }

    for (const enemy of this.level.enemies) {
      drawEnemy(ctx, enemy, this.camX, this.elapsedTime);
    }

    if (this.level.boss) {
      drawMiniBoss(ctx, this.level.boss, this.camX, this.elapsedTime);
    }

    for (const wave of this.arenaWaves) {
      drawArenaWave(ctx, wave, this.camX, this.elapsedTime);
    }

    for (const proj of this.projectiles) {
      drawProjectile(ctx, proj, this.camX, this.elapsedTime);
    }

    drawPlayer(
      ctx,
      this.player,
      this.camX,
      this.elapsedTime,
      this.level.theme === 'UNDERWATER'
    );

    drawParticlesAndText(ctx, this.particles, this.floatingTexts, this.camX);

    if (this.status !== 'TITLE_MENU') {
      drawTopCanvasHUD(ctx, this.buildHudState(), this.elapsedTime);
    }
  }
}
