export type GameStatus =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'HEART_COUNTDOWN'
  | 'LEVEL_CLEAR'
  | 'LEVEL_FAILED'
  | 'CAMPAIGN_VICTORY';

export type LevelTheme = 'LAND' | 'SKY_MUSHROOM' | 'UNDERWATER' | 'FORTRESS';

export type PowerUpType = 'SMALL' | 'BIG' | 'FIRE';

export type MysteryReward = 'COIN' | 'HEART' | 'MUSHROOM' | 'FIRE' | 'TRAP_ENEMY';

export type TileKind =
  | 'EMPTY'
  | 'GROUND_BRICK'
  | 'FLOAT_BRICK'
  | 'MYSTERY'
  | 'USED_BLOCK'
  | 'STONE_SOLID'
  | 'MOSS_STONE'
  | 'PIPE_TOP_L'
  | 'PIPE_TOP_R'
  | 'PIPE_BODY_L'
  | 'PIPE_BODY_R'
  | 'MUSHROOM_STALK'
  | 'MUSHROOM_CAP_L'
  | 'MUSHROOM_CAP_M'
  | 'MUSHROOM_CAP_R'
  | 'BRIDGE_DECK'
  | 'BRIDGE_POST'
  | 'SPIKE_FLOOR'
  | 'LAVA_POOL';

export interface TileData {
  kind: TileKind;
  reward?: MysteryReward;
  bumpOffset?: number;
  bumpVel?: number;
}

export interface PulleyPlatformSide {
  x: number;
  y: number;
  baseY: number;
  w: number;
  h: number;
  vy: number;
}

export interface PulleyPair {
  id: string;
  anchorY: number;
  maxTravel: number;
  offset: number; // positive = left down, right up
  vel: number;
  left: PulleyPlatformSide;
  right: PulleyPlatformSide;
}

export interface MovingPlatform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed: number;
  progress: number;
  dir: 1 | -1;
  vx: number;
  vy: number;
}

export interface CrumblingPlatform {
  id: string;
  x: number;
  y: number;
  baseY: number;
  w: number;
  h: number;
  state: 'IDLE' | 'SHAKING' | 'FALLING' | 'RESPAWNING';
  timer: number;
  vy: number;
  shakeX: number;
}

export interface CurrentZone {
  id: string;
  kind: 'WIND' | 'WATER_CURRENT';
  x: number;
  y: number;
  w: number;
  h: number;
  forceX: number;
  forceY: number;
}

export interface ArenaHazardWave {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  telegraphTimer: number;
  alive: boolean;
}

export type EnemyKind =
  | 'SHROOM'
  | 'TURTLE'
  | 'CHOMP_PLANT'
  | 'SQUID'
  | 'FISH'
  | 'CLOUD_DROPPER';

export interface Enemy {
  id: string;
  kind: EnemyKind;
  variant?: 'NORMAL' | 'FAST' | 'JUMPER';
  jumpTimer?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  alive: boolean;
  squishTimer: number;
  // Turtle shell states
  shellState?: 'WALKING' | 'IDLE_SHELL' | 'SLIDING_SHELL';
  // Chomp plant states
  pipeBaseY?: number;
  pipeTopX?: number;
  plantPhase?: number;
  // Squid/Fish/Cloud timers
  aiTimer: number;
  baseY: number;
  animFrame: number;
}

export type BossPhase =
  | 'PATROL'
  | 'TELEGRAPH_FIRE'
  | 'TELEGRAPH_LEAP'
  | 'LEAPING'
  | 'CHARGE'
  | 'RECOVER_VULNERABLE'
  | 'HURT'
  | 'DEFEATED';

export interface MiniBoss {
  active: boolean;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  phase: BossPhase;
  phaseTimer: number;
  invulnTimer: number;
  arenaLeft: number;
  arenaRight: number;
  groundY: number;
  onGround: boolean;
  speedScale: number;
}

export interface CollectibleItem {
  id: string;
  kind: 'COIN_POP' | 'WORLD_COIN' | 'HEART' | 'MUSHROOM' | 'FIRE';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  emergeY: number;
  emerging: boolean;
  collected: boolean;
  life: number;
}

export interface Projectile {
  id: string;
  fromPlayer: boolean;
  kind: 'PLAYER_FIRE' | 'BOSS_FIRE' | 'DROP_SPIKE' | 'ARENA_FIRE';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  bounces: number;
  alive: boolean;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  wobble: number;
}

export interface SceneryProp {
  kind: 'CLOUD' | 'HILL' | 'BUSH' | 'CORAL' | 'SEAWEED' | 'CASTLE' | 'POST_CHAIN';
  x: number;
  y: number;
  w: number;
  h: number;
  variant: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
}

export interface Flagpole {
  x: number;
  topY: number;
  bottomY: number;
  flagY: number;
  triggered: boolean;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  powerUp: PowerUpType;
  invulnTimer: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  swimCooldown: number;
  fireCooldown: number;
  walkAnim: number;
  alive: boolean;
  lastSafeX: number;
  lastSafeY: number;
  safeRecordTimer: number;
  climbingFlag: boolean;
  walkingToCastle: boolean;
}

export interface LevelData {
  levelNumber: number;
  theme: LevelTheme;
  isBossLevel: boolean;
  widthTiles: number;
  heightTiles: number;
  widthPx: number;
  heightPx: number;
  tiles: TileData[][];
  pulleys: PulleyPair[];
  movingPlatforms: MovingPlatform[];
  crumblingPlatforms: CrumblingPlatform[];
  currentZones: CurrentZone[];
  enemies: Enemy[];
  items: CollectibleItem[];
  scenery: SceneryProp[];
  checkpoints: Checkpoint[];
  flagpole: Flagpole;
  castleX: number;
  castleY: number;
  bossArenaGateX: number | null;
  boss: MiniBoss | null;
  spawnX: number;
  spawnY: number;
  heartBlockCount: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  sprint: boolean;
  fire: boolean;
  firePressed: boolean;
}

export interface SavedRunSummary {
  hasSavedProgress: boolean;
  level: number;
  hearts: number;
  score: number;
  coins: number;
  highScore: number;
}

export interface GameHUDState {
  status: GameStatus;
  level: number;
  isEndless: boolean;
  theme: LevelTheme;
  score: number;
  highScore: number;
  coins: number;
  hearts: number;
  maxHearts: number;
  timeRemaining: number;
  powerUp: PowerUpType;
  isBossLevel: boolean;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  bossVulnerable: boolean;
  bannerMessage: string | null;
  respawnCountdown: number;
  respawnReason: string | null;
  timerWasReset: boolean;
  levelProgressPct: number;
  muted: boolean;
  savedRun: SavedRunSummary;
}
