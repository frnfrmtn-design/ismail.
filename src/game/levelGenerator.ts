import { TILE_SIZE } from './sprites';
import {
  Checkpoint,
  CollectibleItem,
  CrumblingPlatform,
  CurrentZone,
  Enemy,
  LevelData,
  LevelTheme,
  MiniBoss,
  MovingPlatform,
  MysteryReward,
  PulleyPair,
  SceneryProp,
  TileData,
  TileKind,
} from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getThemeForLevel(levelNumber: number): LevelTheme {
  if (levelNumber === 1) return 'LAND';
  if (levelNumber === 2) return 'LAND';
  if (levelNumber === 3) return 'SKY_MUSHROOM';
  if (levelNumber === 4) return 'UNDERWATER';
  const mod = (levelNumber - 1) % 6;
  if (mod === 0 || mod === 1) return 'LAND';
  if (mod === 2) return 'SKY_MUSHROOM';
  if (mod === 3) return 'UNDERWATER';
  if (mod === 4) return 'SKY_MUSHROOM';
  return 'FORTRESS';
}

const BOSS_NAMES = [
  'SPIKE SHELL GUARDIAN',
  'IRON CLAW TITAN',
  'CRIMSON CARAPACE',
  'ABYSSAL DREADNOUGHT',
  'SKY FORGE WARDEN',
  'OMEGA BASTION',
];

export function generateLevel(levelNumber: number): LevelData {
  const rng = mulberry32(levelNumber * 2654435761 + 1013904223);
  const theme = getThemeForLevel(levelNumber);
  const isBossLevel = levelNumber % 2 === 0;
  const difficulty = Math.min(1, (levelNumber - 1) / 85); // 0.0 -> 1.0 across 1..85+
  const endlessLevel = Math.max(0, levelNumber - 100);
  const endlessSpeedBoost =
    endlessLevel > 0 ? Math.min(1.5, endlessLevel * 0.036 + Math.log1p(endlessLevel) * 0.16) : 0;
  const endlessDensity =
    endlessLevel > 0 ? Math.min(1.0, endlessLevel * 0.045 + Math.log1p(endlessLevel) * 0.14) : 0;
  const endlessExtraPerChunk =
    endlessLevel > 0 ? Math.min(4, 1 + Math.floor((endlessLevel - 1) / 3)) : 0;
  const endlessVariantRate =
    endlessLevel > 0 ? Math.min(0.75, 0.2 + endlessLevel * 0.035) : 0;
  const endlessBreatherTrim = endlessLevel > 0 ? Math.min(3, Math.floor((endlessLevel + 2) / 4)) : 0;

  // 27,520px to 34,560px wide (~10 minutes of casual exploration)
  const widthTiles = Math.min(1080, 860 + Math.floor(levelNumber * 2.1));
  const heightTiles = 17; // 17 * 32 = 544px (~540px viewport height)
  const groundRow = 15; // Rows 15 & 16 are ground

  const tiles: TileData[][] = Array.from({ length: heightTiles }, () =>
    Array.from({ length: widthTiles }, (): TileData => ({ kind: 'EMPTY' }))
  );

  const pulleys: PulleyPair[] = [];
  const movingPlatforms: MovingPlatform[] = [];
  const crumblingPlatforms: CrumblingPlatform[] = [];
  const currentZones: CurrentZone[] = [];
  const enemies: Enemy[] = [];
  const items: CollectibleItem[] = [];
  const scenery: SceneryProp[] = [];
  const checkpoints: Checkpoint[] = [];

  const setTile = (tx: number, ty: number, kind: TileKind, reward?: MysteryReward) => {
    if (tx < 0 || tx >= widthTiles || ty < 0 || ty >= heightTiles) return;
    tiles[ty][tx] = reward ? { kind, reward } : { kind };
  };

  const groundKind: TileKind =
    theme === 'UNDERWATER' ? 'MOSS_STONE' : 'GROUND_BRICK';

  // Helper to fill ground column
  const fillGround = (startX: number, endX: number, topRow = groundRow) => {
    for (let x = startX; x <= endX && x < widthTiles; x++) {
      for (let y = topRow; y < heightTiles; y++) {
        setTile(x, y, groundKind);
      }
    }
  };

  // Safe starting runway (0..18)
  fillGround(0, 18);

  // Guaranteed 3 Heart blocks placed in Early (~14%), Mid (~44%), and Late (~73%) sections
  // (2-3 per level)
  const heartZones = [
    Math.floor(widthTiles * 0.14),
    Math.floor(widthTiles * 0.44),
    Math.floor(widthTiles * 0.73),
  ];
  let heartPlaced = [false, false, false];
  let heartBlockCount = 0;

  const tryPlaceHeartBlock = (tx: number, ty: number): boolean => {
    for (let i = 0; i < heartZones.length; i++) {
      if (!heartPlaced[i] && tx >= heartZones[i] - 10) {
        heartPlaced[i] = true;
        heartBlockCount++;
        setTile(tx, ty, 'MYSTERY', 'HEART');
        return true;
      }
    }
    return false;
  };

  const spawnMysteryCluster = (startX: number, row: number, len: number, forcePower = false) => {
    for (let i = 0; i < len; i++) {
      const tx = startX + i;
      if (i % 2 === 1 || len === 1) {
        if (!tryPlaceHeartBlock(tx, row)) {
          let reward: MysteryReward = 'COIN';
          if (forcePower && i === Math.floor(len / 2)) {
            const roll = rng();
            reward = roll < 0.65 ? 'MUSHROOM' : 'FIRE';
          } else {
            const roll = rng();
            const trapCutoff = 0.44 + endlessDensity * 0.12;
            if (roll < 0.17) reward = 'MUSHROOM';
            else if (roll < 0.27) reward = 'FIRE';
            else if (roll < trapCutoff) reward = 'TRAP_ENEMY';
          }
          setTile(tx, row, 'MYSTERY', reward);
        }
      } else {
        setTile(tx, row, 'FLOAT_BRICK');
      }
    }
  };

  const spawnPipe = (tx: number, height: number, hasChomp: boolean) => {
    const topY = groundRow - height;
    setTile(tx, topY, 'PIPE_TOP_L');
    setTile(tx + 1, topY, 'PIPE_TOP_R');
    for (let y = topY + 1; y < groundRow; y++) {
      setTile(tx, y, 'PIPE_BODY_L');
      setTile(tx + 1, y, 'PIPE_BODY_R');
    }
    if (hasChomp && theme !== 'UNDERWATER') {
      const plantH = 30;
      enemies.push({
        id: `chomp_${tx}`,
        kind: 'CHOMP_PLANT',
        x: tx * TILE_SIZE + 18,
        y: topY * TILE_SIZE,
        w: 28,
        h: plantH,
        vx: 0,
        vy: 0,
        dir: -1,
        alive: true,
        squishTimer: 0,
        pipeBaseY: topY * TILE_SIZE,
        pipeTopX: tx * TILE_SIZE,
        plantPhase: rng() * Math.PI * 2,
        aiTimer: 0,
        baseY: topY * TILE_SIZE,
        animFrame: 0,
      });
    }
  };

  const spawnMushroomPlatform = (tx: number, topRow: number, width: number) => {
    const mid = tx + Math.floor(width / 2);
    for (let y = topRow + 1; y < groundRow + 2; y++) {
      setTile(mid, y, 'MUSHROOM_STALK');
    }
    for (let i = 0; i < width; i++) {
      const kind: TileKind =
        i === 0 ? 'MUSHROOM_CAP_L' : i === width - 1 ? 'MUSHROOM_CAP_R' : 'MUSHROOM_CAP_M';
      setTile(tx + i, topRow, kind);
    }
  };

  const spawnPulley = (tx: number, gapWidth: number) => {
    const anchorY = 112;
    const leftX = (tx + 1) * TILE_SIZE;
    const rightX = (tx + gapWidth - 4) * TILE_SIZE;
    const baseY = 11 * TILE_SIZE;
    pulleys.push({
      id: `pulley_${tx}`,
      anchorY,
      maxTravel: 64,
      offset: 0,
      vel: 0,
      left: { x: leftX, y: baseY, baseY, w: 80, h: 16, vy: 0 },
      right: { x: rightX, y: baseY, baseY, w: 80, h: 16, vy: 0 },
    });
  };

  const spawnCoinArc = (startX: number, baseRow: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const arc = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 1.6;
      items.push({
        id: `wc_${startX}_${i}`,
        kind: 'WORLD_COIN',
        x: (startX + i) * TILE_SIZE + 5,
        y: (baseRow - arc) * TILE_SIZE,
        w: 22,
        h: 22,
        vx: 0,
        vy: 0,
        emergeY: 0,
        emerging: false,
        collected: false,
        life: 9999,
      });
    }
  };

  const pickEndlessVariant = (allowJumper = true): Enemy['variant'] => {
    if (endlessLevel <= 0) return 'NORMAL';
    if (rng() >= endlessVariantRate) return 'NORMAL';
    if (!allowJumper) return 'FAST';
    return rng() < 0.52 ? 'FAST' : 'JUMPER';
  };

  const canPlaceGroundEnemyAt = (tx: number, row: number): boolean => {
    if (tx < 19 || tx >= widthTiles - 20) return false;
    if (row < 2 || row >= heightTiles) return false;
    const support = tiles[row]?.[tx]?.kind;
    const body = tiles[row - 1]?.[tx]?.kind;
    if (!support || !body) return false;
    const hasSupport =
      support === groundKind ||
      support === 'STONE_SOLID' ||
      support === 'FLOAT_BRICK' ||
      support === 'BRIDGE_DECK' ||
      support === 'MUSHROOM_CAP_L' ||
      support === 'MUSHROOM_CAP_M' ||
      support === 'MUSHROOM_CAP_R';
    const bodyClear =
      body === 'EMPTY' || body === 'BRIDGE_POST';
    return hasSupport && bodyClear;
  };

  const spawnEnemy = (
    kind: Enemy['kind'],
    tx: number,
    row: number,
    variantOverride?: Enemy['variant']
  ) => {
    const x = tx * TILE_SIZE;
    const y = row * TILE_SIZE;
    const allowJumper = kind === 'SHROOM' || kind === 'TURTLE';
    const variant = variantOverride ?? pickEndlessVariant(allowJumper);
    const speedMult = variant === 'FAST' ? 1.38 : 1.0;
    const baseSpeed =
      (58 + difficulty * 55 + endlessSpeedBoost * 72) * speedMult * (rng() < 0.5 ? -1 : 1);

    if (kind === 'SHROOM') {
      enemies.push({
        id: `sh_${tx}_${enemies.length}`,
        kind: 'SHROOM',
        variant,
        jumpTimer: variant === 'JUMPER' ? 0.5 + rng() * 0.9 : 0,
        x,
        y: y - 26,
        w: 26,
        h: 26,
        vx: baseSpeed,
        vy: 0,
        dir: baseSpeed < 0 ? -1 : 1,
        alive: true,
        squishTimer: 0,
        aiTimer: 0,
        baseY: y - 26,
        animFrame: 0,
      });
    } else if (kind === 'TURTLE') {
      enemies.push({
        id: `tu_${tx}_${enemies.length}`,
        kind: 'TURTLE',
        variant,
        jumpTimer: variant === 'JUMPER' ? 0.6 + rng() * 0.95 : 0,
        x,
        y: y - 32,
        w: 28,
        h: 32,
        vx: baseSpeed * 0.9,
        vy: 0,
        dir: baseSpeed < 0 ? -1 : 1,
        alive: true,
        squishTimer: 0,
        shellState: 'WALKING',
        aiTimer: 0,
        baseY: y - 32,
        animFrame: 0,
      });
    } else if (kind === 'SQUID') {
      enemies.push({
        id: `sq_${tx}_${enemies.length}`,
        kind: 'SQUID',
        variant,
        x,
        y: y - 64,
        w: 26,
        h: 28,
        vx: -(40 + difficulty * 35 + endlessSpeedBoost * 58) * speedMult,
        vy: 0,
        dir: -1,
        alive: true,
        squishTimer: 0,
        aiTimer: rng() * 2,
        baseY: y - 64,
        animFrame: 0,
      });
    } else if (kind === 'FISH') {
      enemies.push({
        id: `fi_${tx}_${enemies.length}`,
        kind: 'FISH',
        variant,
        x,
        y: y - 48,
        w: 28,
        h: 24,
        vx: -(65 + difficulty * 45 + endlessSpeedBoost * 68) * speedMult,
        vy: 0,
        dir: -1,
        alive: true,
        squishTimer: 0,
        aiTimer: rng() * Math.PI * 2,
        baseY: y - 48,
        animFrame: 0,
      });
    } else if (kind === 'CLOUD_DROPPER') {
      enemies.push({
        id: `cl_${tx}_${enemies.length}`,
        kind: 'CLOUD_DROPPER',
        variant,
        x,
        y: 80 + Math.floor(rng() * 38),
        w: 44,
        h: 24,
        vx: (55 + difficulty * 35 + endlessSpeedBoost * 55) * speedMult,
        vy: 0,
        dir: 1,
        alive: true,
        squishTimer: 0,
        aiTimer: Math.max(0.55, 1.5 - endlessDensity * 0.7) + rng() * 0.9,
        baseY: 96,
        animFrame: 0,
      });
    }
  };

  const spawnEndlessGroundSquad = (startTx: number, endTx: number, row: number, count: number) => {
    if (count <= 0) return;
    let placed = 0;
    const span = Math.max(1, endTx - startTx);
    for (let attempt = 0; attempt < count * 3 && placed < count; attempt++) {
      const tx = startTx + Math.floor(((attempt + 0.5) / (count * 3)) * span);
      if (canPlaceGroundEnemyAt(tx, row)) {
        spawnEnemy(rng() < 0.55 ? 'SHROOM' : 'TURTLE', tx, row);
        placed++;
      }
    }
  };

  // Build modular chunks from x = 19 up to Finale start
  const finaleStart = widthTiles - (isBossLevel ? 56 : 36);
  const cp1Tile = Math.floor(widthTiles * 0.26);
  const cp2Tile = Math.floor(widthTiles * 0.52);
  const cp3Tile = Math.floor(widthTiles * 0.77);
  let cp1Added = false;
  let cp2Added = false;
  let cp3Added = false;

  let placedCrumble = false;
  let placedHazard = false;
  let placedCurrent = false;
  let placedMoving = false;

  const spawnCrumblePlatform = (tx: number, row: number, widthPx = 76) => {
    placedCrumble = true;
    crumblingPlatforms.push({
      id: `cr_${tx}_${row}_${crumblingPlatforms.length}`,
      x: tx * TILE_SIZE,
      y: row * TILE_SIZE,
      baseY: row * TILE_SIZE,
      w: widthPx,
      h: 16,
      state: 'IDLE',
      timer: 0,
      vy: 0,
      shakeX: 0,
    });
  };

  const fillLavaTrench = (startX: number, endX: number) => {
    placedHazard = true;
    for (let x = startX; x <= endX && x < widthTiles; x++) {
      setTile(x, groundRow, 'LAVA_POOL');
      setTile(x, groundRow + 1, 'LAVA_POOL');
    }
  };

  let cursor = 19;
  let chunkIdx = 0;

  while (cursor < finaleStart - 18) {
    chunkIdx++;

    // 3 Checkpoint plateaus evenly spaced across ~10-minute level
    if (!cp1Added && cursor >= cp1Tile) {
      cp1Added = true;
      fillGround(cursor, cursor + 12);
      checkpoints.push({ x: (cursor + 5) * TILE_SIZE, y: groundRow * TILE_SIZE, activated: false });
      spawnMysteryCluster(cursor + 3, groundRow - 4, 3, true);
      cursor += 13;
      continue;
    }
    if (!cp2Added && cursor >= cp2Tile) {
      cp2Added = true;
      fillGround(cursor, cursor + 12);
      checkpoints.push({ x: (cursor + 5) * TILE_SIZE, y: groundRow * TILE_SIZE, activated: false });
      spawnMysteryCluster(cursor + 3, groundRow - 4, 3, true);
      cursor += 13;
      continue;
    }
    if (!cp3Added && cursor >= cp3Tile) {
      cp3Added = true;
      fillGround(cursor, cursor + 12);
      checkpoints.push({ x: (cursor + 5) * TILE_SIZE, y: groundRow * TILE_SIZE, activated: false });
      spawnMysteryCluster(cursor + 3, groundRow - 4, 3, true);
      cursor += 13;
      continue;
    }

    const progress = cursor / widthTiles;
    const roll = rng();

    if (theme === 'UNDERWATER') {
      // Underwater ocean reef segments with water currents, crumbling shelves & spike/lava vents
      const segLen = Math.max(13, 16 + Math.floor(rng() * 8) - endlessBreatherTrim);
      fillGround(cursor, cursor + segLen);

      if (rng() < 0.7) {
        scenery.push({
          kind: rng() < 0.5 ? 'SEAWEED' : 'CORAL',
          x: (cursor + 2 + Math.floor(rng() * 4)) * TILE_SIZE,
          y: (groundRow - 2) * TILE_SIZE,
          w: 32,
          h: 64,
          variant: chunkIdx,
        });
      }

      if (!placedCurrent || roll < 0.25 + endlessDensity * 0.2) {
        placedCurrent = true;
        const dir = rng() < 0.5 ? -1 : 1;
        currentZones.push({
          id: `cur_${cursor}`,
          kind: 'WATER_CURRENT',
          x: (cursor + 2) * TILE_SIZE,
          y: 72,
          w: (segLen - 3) * TILE_SIZE,
          h: 340,
          forceX: dir * (115 + difficulty * 55 + endlessSpeedBoost * 50),
          forceY: rng() < 0.5 ? -35 : 35,
        });
      }

      if (!placedCrumble || roll < 0.38) {
        const shelfRow = 9 + Math.floor(rng() * 2);
        fillLavaTrench(cursor + 4, cursor + 10);
        spawnCrumblePlatform(cursor + 4, shelfRow, 76);
        spawnCrumblePlatform(cursor + 7.5, shelfRow - 1, 76);
        spawnCoinArc(cursor + 5, shelfRow - 2, 5);
        spawnMysteryCluster(cursor + 12, 10, 3, chunkIdx % 3 === 0);
      } else if (!placedHazard || roll < 0.68 + endlessDensity * 0.1) {
        placedHazard = true;
        // Underwater spike reef + thermal trench (safe floor under ? cluster)
        setTile(cursor + 4, groundRow - 1, 'SPIKE_FLOOR');
        setTile(cursor + 5, groundRow - 1, 'SPIKE_FLOOR');
        fillLavaTrench(cursor + 7, cursor + 9);
        spawnCoinArc(cursor + 4, 10, 5);
        spawnMysteryCluster(cursor + 11, 10, 3, false);
      } else if (!placedMoving || roll < 0.84) {
        placedMoving = true;
        movingPlatforms.push({
          id: `mp_uw_${cursor}`,
          x: (cursor + 5) * TILE_SIZE,
          y: 10 * TILE_SIZE,
          w: 84,
          h: 16,
          startX: (cursor + 4) * TILE_SIZE,
          startY: 11 * TILE_SIZE,
          endX: (cursor + 10) * TILE_SIZE,
          endY: 8 * TILE_SIZE,
          speed: 70 + difficulty * 40 + endlessSpeedBoost * 62,
          progress: 0,
          dir: 1,
          vx: 0,
          vy: 0,
        });
        spawnMysteryCluster(cursor + 12, 10, 3, true);
      } else {
        spawnMysteryCluster(cursor + 4, 10, 4, true);
      }

      // Aquatic enemies (escalates continuously in Endless 101+)
      const enemyCount =
        1 + (rng() < 0.5 + difficulty * 0.35 ? 1 : 0) + endlessExtraPerChunk;
      for (let e = 0; e < enemyCount; e++) {
        const ex = cursor + 3 + ((e * 3) % Math.max(4, segLen - 4));
        const ey = 6 + ((e * 2 + Math.floor(rng() * 4)) % 7);
        spawnEnemy(rng() < 0.5 ? 'SQUID' : 'FISH', ex, ey);
      }

      cursor += segLen + 1;
      continue;
    }

      const chunkStart = cursor;
      let chunkAdvance = 17;

      // LAND / SKY_MUSHROOM / FORTRESS segments
      // Guarantee every level showcases Crumbling Bridges, Lava/Spike Gaps, Wind Zones & Moving Lifts
      if (!placedCrumble && progress > 0.14) {
        // Crumbling Bridge Over Lava Trench! (Mystery cluster on safe solid ground after bridge)
        const secLen = 19;
        fillGround(cursor, cursor + 2);
        fillLavaTrench(cursor + 3, cursor + 13);
        spawnCrumblePlatform(cursor + 3.5, groundRow - 2, 72);
        spawnCrumblePlatform(cursor + 7, groundRow - 3, 72);
        spawnCrumblePlatform(cursor + 10.5, groundRow - 2, 72);
        fillGround(cursor + 14, cursor + secLen);
        spawnMysteryCluster(cursor + 15, groundRow - 4, 3, true);
        spawnCoinArc(cursor + 5, groundRow - 5, 6);
        chunkAdvance = secLen + 1;
      } else if (!placedHazard && progress > 0.22) {
        // Spike Floor Gauntlet with clean, unobstructed ? blocks on safe floor
        const secLen = 18;
        fillGround(cursor, cursor + secLen);
        spawnMysteryCluster(cursor + 2, groundRow - 4, 3, false);
        setTile(cursor + 7, groundRow - 1, 'SPIKE_FLOOR');
        setTile(cursor + 8, groundRow - 1, 'SPIKE_FLOOR');
        setTile(cursor + 11, groundRow - 1, 'SPIKE_FLOOR');
        spawnMysteryCluster(cursor + 14, groundRow - 4, 3, true);
        spawnEnemy('SHROOM', cursor + 9, groundRow);
        chunkAdvance = secLen + 1;
      } else if (!placedCurrent && progress > 0.32) {
        // Open Sky Wind Gust Crossing!
        placedCurrent = true;
        const secLen = 18;
        fillGround(cursor, cursor + 3);
        fillLavaTrench(cursor + 4, cursor + 13);
        spawnCrumblePlatform(cursor + 4.5, groundRow - 3, 80);
        spawnCrumblePlatform(cursor + 9.5, groundRow - 4, 80);
        fillGround(cursor + 14, cursor + secLen);
        currentZones.push({
          id: `wind_${cursor}`,
          kind: 'WIND',
          x: (cursor + 3) * TILE_SIZE,
          y: 64,
          w: 12 * TILE_SIZE,
          h: 390,
          forceX: (rng() < 0.5 ? -1 : 1) * (135 + difficulty * 55 + endlessSpeedBoost * 50),
          forceY: 0,
        });
        spawnCoinArc(cursor + 5, groundRow - 6, 6);
        chunkAdvance = secLen + 1;
      } else if (!placedMoving && progress > 0.42) {
        // Moving Lift Chasm
        placedMoving = true;
        const secLen = 16;
        fillGround(cursor, cursor + 3);
        movingPlatforms.push({
          id: `mp_req_${cursor}`,
          x: (cursor + 5) * TILE_SIZE,
          y: (groundRow - 3) * TILE_SIZE,
          w: 84,
          h: 16,
          startX: (cursor + 4.5) * TILE_SIZE,
          startY: (groundRow - 3) * TILE_SIZE,
          endX: (cursor + 9.5) * TILE_SIZE,
          endY: (groundRow - 5) * TILE_SIZE,
          speed: 75 + difficulty * 45 + endlessSpeedBoost * 68,
          progress: 0,
          dir: 1,
          vx: 0,
          vy: 0,
        });
        fillGround(cursor + 12, cursor + secLen);
        spawnMysteryCluster(cursor + 13, groundRow - 4, 3, true);
        chunkAdvance = secLen + 1;
      } else if (
        (theme === 'SKY_MUSHROOM' && roll < 0.38) ||
        (theme !== 'FORTRESS' && roll < 0.14 && progress > 0.2)
      ) {
        // Giant Mushroom Stalk Canopy Section (with optional wind gust)
        const secLen = Math.max(15, 18 - Math.min(2, endlessBreatherTrim));
        if (progress < 0.25 || rng() < 0.35) {
          fillGround(cursor, cursor + secLen);
        } else {
          fillGround(cursor, cursor + 2);
          fillGround(cursor + secLen - 2, cursor + secLen);
        }
        spawnMushroomPlatform(cursor + 3, 11, 5);
        spawnMushroomPlatform(cursor + 10, 8, 5);
        spawnMysteryCluster(cursor + 11, 4, 3, chunkIdx % 2 === 0);
        spawnCoinArc(cursor + 4, 9, 4);
        spawnEnemy(rng() < 0.5 ? 'TURTLE' : 'SHROOM', cursor + 12, 8);
        if (endlessLevel > 0) {
          spawnEnemy(rng() < 0.5 ? 'SHROOM' : 'TURTLE', cursor + 5, 11);
        }
        if (rng() < 0.35 + endlessDensity * 0.25) {
          currentZones.push({
            id: `wind_mush_${cursor}`,
            kind: 'WIND',
            x: (cursor + 2) * TILE_SIZE,
            y: 64,
            w: 14 * TILE_SIZE,
            h: 340,
            forceX: (rng() < 0.5 ? -1 : 1) * (120 + difficulty * 50 + endlessSpeedBoost * 45),
            forceY: 0,
          });
        }
        chunkAdvance = secLen + 1;
      } else if (roll < 0.3 && progress > 0.15) {
        // Linked Pulley Counterweight Lift Chasm!
        const chasmW = 14;
        fillGround(cursor, cursor + 2);
        fillGround(cursor + chasmW - 2, cursor + chasmW);
        spawnPulley(cursor + 2, chasmW - 4);
        spawnCoinArc(cursor + 4, 6, 5);
        if (!heartPlaced[1] && cursor >= heartZones[1] - 12) {
          tryPlaceHeartBlock(cursor + chasmW - 1, groundRow - 4);
        }
        if (endlessLevel > 0 && rng() < 0.45 + endlessDensity * 0.35) {
          spawnEnemy('CLOUD_DROPPER', cursor + 6, 4);
        }
        chunkAdvance = chasmW + 1;
      } else if (roll < 0.46) {
        // Pipe Alley with Chomp Plants & Mystery Blocks (no spikes beneath ? blocks)
        const secLen = Math.max(14, 16 - Math.min(2, endlessBreatherTrim));
        fillGround(cursor, cursor + secLen);
        const p1H = 2 + Math.floor(rng() * 2);
        const p2H = 3 + Math.floor(rng() * 2);
        spawnPipe(cursor + 3, p1H, progress > 0.06 || levelNumber > 1);
        spawnMysteryCluster(cursor + 7, groundRow - 4, 3, chunkIdx % 3 === 1);
        spawnPipe(cursor + Math.min(secLen - 3, 12), p2H, true);
        if (rng() < 0.65 + difficulty * 0.25 + endlessDensity * 0.1) {
          spawnEnemy('SHROOM', cursor + 6, groundRow);
        }
        chunkAdvance = secLen + 1;
      } else if (roll < 0.62) {
        // Bridge Crossing (mix of solid bridge + crumbling planks over lava)
        const secLen = 19;
        fillGround(cursor, cursor + 2);
        if (rng() < 0.55 + endlessDensity * 0.2) {
          fillLavaTrench(cursor + 3, cursor + 13);
          spawnCrumblePlatform(cursor + 3.5, groundRow - 2, 72);
          spawnCrumblePlatform(cursor + 7, groundRow - 2, 72);
          spawnCrumblePlatform(cursor + 10.5, groundRow - 2, 72);
        } else {
          for (let bx = cursor + 3; bx <= cursor + 13; bx++) {
            setTile(bx, groundRow - 2, 'BRIDGE_DECK');
            if (bx === cursor + 3 || bx === cursor + 13) {
              for (let py = groundRow - 5; py < groundRow - 2; py++) {
                setTile(bx, py, 'BRIDGE_POST');
              }
            }
          }
          spawnEnemy('TURTLE', cursor + 7, groundRow - 2);
          if (endlessLevel > 0) {
            spawnEnemy('SHROOM', cursor + 10, groundRow - 2);
          }
        }
        fillGround(cursor + 14, cursor + secLen);
        spawnCoinArc(cursor + 5, groundRow - 4, 6);
        spawnMysteryCluster(cursor + 15, groundRow - 4, 3, false);
        if (progress > 0.3 && rng() < 0.5 + difficulty * 0.3 + endlessDensity * 0.2) {
          spawnEnemy('CLOUD_DROPPER', cursor + 6, 4);
        }
        chunkAdvance = secLen + 1;
      } else if (roll < 0.8) {
        // Classic Brick Pyramid, Spike Trap & High/Low Path (spikes placed clear of ? blocks)
        const secLen = Math.max(15, 18 - endlessBreatherTrim);
        fillGround(cursor, cursor + secLen);
        spawnMysteryCluster(cursor + 2, groundRow - 4, 4, true);
        if (rng() < 0.5 + endlessDensity * 0.35) {
          setTile(cursor + secLen - 4, groundRow - 1, 'SPIKE_FLOOR');
          setTile(cursor + secLen - 3, groundRow - 1, 'SPIKE_FLOOR');
        }
        // Upper brick terrace
        for (let ux = cursor + 8; ux <= cursor + 13; ux++) {
          setTile(ux, groundRow - 8, 'FLOAT_BRICK');
        }
        tryPlaceHeartBlock(cursor + 10, groundRow - 11);
        spawnCoinArc(cursor + 9, groundRow - 9, 4);
        spawnEnemy('SHROOM', cursor + 6, groundRow);
        spawnEnemy('TURTLE', cursor + 11, groundRow);
        if ((progress > 0.25 && rng() < 0.45) || endlessLevel > 0) {
          spawnEnemy('SHROOM', cursor + 10, groundRow - 8);
        }
        chunkAdvance = secLen + 1;
      } else {
        // Moving Platform Gap + Stairs over Lava Pit
        const secLen = 16;
        fillGround(cursor, cursor + 3);
        fillLavaTrench(cursor + 4, cursor + 11);
        setTile(cursor + 2, groundRow - 1, 'STONE_SOLID');
        setTile(cursor + 3, groundRow - 1, 'STONE_SOLID');
        setTile(cursor + 3, groundRow - 2, 'STONE_SOLID');

        movingPlatforms.push({
          id: `mp_${cursor}`,
          x: (cursor + 5) * TILE_SIZE,
          y: (groundRow - 3) * TILE_SIZE,
          w: 84,
          h: 16,
          startX: (cursor + 4.5) * TILE_SIZE,
          startY: (groundRow - 3) * TILE_SIZE,
          endX: (cursor + 9.5) * TILE_SIZE,
          endY: (groundRow - 5) * TILE_SIZE,
          speed: 75 + difficulty * 45 + endlessSpeedBoost * 68,
          progress: 0,
          dir: 1,
          vx: 0,
          vy: 0,
        });

        fillGround(cursor + 12, cursor + secLen);
        spawnMysteryCluster(cursor + 13, groundRow - 4, 3, false);
        spawnEnemy('SHROOM', cursor + 14, groundRow);
        chunkAdvance = secLen + 1;
      }

      // Endless Mode (101+) relentless enemy density & aerial hazards escalation per chunk
      if (endlessLevel > 0 && chunkStart > 22) {
        const chunkEnd = chunkStart + chunkAdvance - 2;
        spawnEndlessGroundSquad(chunkStart + 1, chunkEnd, groundRow, Math.min(3, endlessExtraPerChunk));
        if (rng() < 0.22 + endlessDensity * 0.42) {
          spawnEnemy('CLOUD_DROPPER', chunkStart + Math.floor(chunkAdvance / 2), 4);
        }
      }

      cursor += chunkAdvance;

      // Add background bushes for Land
      if (theme === 'LAND' && rng() < 0.5) {
        scenery.push({
          kind: 'BUSH',
          x: (cursor - 10) * TILE_SIZE,
          y: (groundRow - 1) * TILE_SIZE,
          w: 64,
          h: 32,
          variant: chunkIdx,
        });
      }
    }

  // Pre-Finale Final Approach: cleanly bridge any remaining distance between last chunk and finaleStart
  if (cursor < finaleStart) {
    const remaining = finaleStart - cursor;
    if (remaining >= 10 && theme !== 'UNDERWATER') {
      // Stepping stone / brick platform final approach with comfortable <= 2-tile gaps
      fillGround(cursor, cursor + 1);
      let stepX = cursor + 4;
      while (stepX + 3 <= finaleStart - 4) {
        fillGround(stepX, stepX + 2);
        spawnMysteryCluster(stepX, groundRow - 4, 3, false);
        spawnCoinArc(stepX, groundRow - 6, 3);
        stepX += 5; // 3 solid tiles + 2-tile comfortable gap
      }
      fillGround(Math.max(cursor + 2, stepX), finaleStart - 1);
    } else {
      fillGround(cursor, finaleStart - 1);
    }
  }

  // Ensure all 3 guaranteed Heart blocks exist even if RNG skipped a cluster near the zone
  for (let i = 0; i < heartZones.length; i++) {
    if (!heartPlaced[i]) {
      const tx = Math.min(finaleStart - 6, Math.max(22, heartZones[i]));
      fillGround(tx - 2, tx + 2);
      setTile(tx, groundRow - 4, 'MYSTERY', 'HEART');
      heartPlaced[i] = true;
      heartBlockCount++;
    }
  }

  // FINALE ZONE
  fillGround(finaleStart, widthTiles - 1);

  // Universal Gap Safety Audit Pass:
  // Ensure no uncrossable pit or chasm (> 3 tiles without any solid/platform foothold) exists anywhere.
  const hasFootholdCol = new Array<boolean>(widthTiles).fill(false);
  for (let tx = 0; tx < widthTiles; tx++) {
    for (let ty = 0; ty < heightTiles; ty++) {
      const k = tiles[ty][tx].kind;
      if (
        k === 'GROUND_BRICK' ||
        k === 'MOSS_STONE' ||
        k === 'STONE_SOLID' ||
        k === 'FLOAT_BRICK' ||
        k === 'MYSTERY' ||
        k === 'USED_BLOCK' ||
        k === 'MUSHROOM_CAP_L' ||
        k === 'MUSHROOM_CAP_M' ||
        k === 'MUSHROOM_CAP_R' ||
        k === 'BRIDGE_DECK' ||
        k === 'PIPE_TOP_L' ||
        k === 'PIPE_TOP_R'
      ) {
        hasFootholdCol[tx] = true;
        break;
      }
    }
  }
  for (const cp of crumblingPlatforms) {
    const s = Math.floor(cp.x / TILE_SIZE);
    const e = Math.ceil((cp.x + cp.w) / TILE_SIZE);
    for (let tx = s; tx < e; tx++) {
      if (tx >= 0 && tx < widthTiles) hasFootholdCol[tx] = true;
    }
  }
  for (const mp of movingPlatforms) {
    const minX = Math.min(mp.startX, mp.endX);
    const maxX = Math.max(mp.startX, mp.endX) + mp.w;
    const s = Math.floor(minX / TILE_SIZE);
    const e = Math.ceil(maxX / TILE_SIZE);
    for (let tx = s; tx < e; tx++) {
      if (tx >= 0 && tx < widthTiles) hasFootholdCol[tx] = true;
    }
  }
  for (const pl of pulleys) {
    for (const side of [pl.left, pl.right]) {
      const s = Math.floor(side.x / TILE_SIZE);
      const e = Math.ceil((side.x + side.w) / TILE_SIZE);
      for (let tx = s; tx < e; tx++) {
        if (tx >= 0 && tx < widthTiles) hasFootholdCol[tx] = true;
      }
    }
  }

  let gapStartCol = -1;
  for (let tx = 0; tx <= widthTiles; tx++) {
    const solid = tx < widthTiles ? hasFootholdCol[tx] : true;
    if (!solid) {
      if (gapStartCol === -1) gapStartCol = tx;
    } else if (gapStartCol !== -1) {
      const gapEndCol = tx - 1;
      const gapLen = gapEndCol - gapStartCol + 1;
      if (gapLen > 3) {
        // Place comfortable 3-tile stepping brick/stone platforms leaving <= 2-tile gaps
        for (let bx = gapStartCol + 2; bx <= gapEndCol - 1; bx += 4) {
          const spanEnd = Math.min(gapEndCol, bx + 2);
          for (let px = bx; px <= spanEnd; px++) {
            setTile(px, groundRow - 2, 'FLOAT_BRICK');
            hasFootholdCol[px] = true;
          }
        }
      }
      gapStartCol = -1;
    }
  }

  // Structural Safety Guarantee:
  // Remove any spikes, lava, or open pits underneath or in the takeoff/landing path (tx - 1 .. tx + 1)
  // directly below any '?' mystery block so every '?' block has clean, safe footing below it.
  for (let ty = 0; ty < heightTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      if (tiles[ty][tx].kind !== 'MYSTERY') continue;
      for (let checkX = Math.max(0, tx - 1); checkX <= Math.min(widthTiles - 1, tx + 1); checkX++) {
        let hasSolidPlatformBelow = false;
        for (let y = ty + 1; y < heightTiles; y++) {
          const k = tiles[y][checkX].kind;
          if (k === 'SPIKE_FLOOR') {
            tiles[y][checkX] = { kind: 'EMPTY' };
          } else if (k === 'LAVA_POOL') {
            tiles[y][checkX] = { kind: groundKind };
            hasSolidPlatformBelow = true;
          } else if (
            k === 'GROUND_BRICK' ||
            k === 'MOSS_STONE' ||
            k === 'STONE_SOLID' ||
            k === 'FLOAT_BRICK' ||
            k === 'MUSHROOM_CAP_L' ||
            k === 'MUSHROOM_CAP_M' ||
            k === 'MUSHROOM_CAP_R' ||
            k === 'BRIDGE_DECK'
          ) {
            hasSolidPlatformBelow = true;
          }
        }
        if (!hasSolidPlatformBelow) {
          for (let y = groundRow; y < heightTiles; y++) {
            tiles[y][checkX] = { kind: groundKind };
          }
        }
      }
    }
  }

  let bossArenaGateX: number | null = null;
  let boss: MiniBoss | null = null;
  let flagpoleTileX = widthTiles - 14;

  if (isBossLevel) {
    // Checkpoint right before Boss Bridge Arena
    const gateTile = finaleStart + 3;
    checkpoints.push({
      x: gateTile * TILE_SIZE,
      y: groundRow * TILE_SIZE,
      activated: false,
    });
    bossArenaGateX = (gateTile + 2) * TILE_SIZE;

    // Boss Bridge Arena (gateTile+4 .. gateTile+28)
    const arenaStart = gateTile + 4;
    const arenaEnd = gateTile + 28;
    for (let bx = arenaStart; bx <= arenaEnd; bx++) {
      setTile(bx, groundRow, groundKind);
      setTile(bx, groundRow - 1, 'BRIDGE_DECK');
    }
    // Arena boundary posts
    for (let py = groundRow - 6; py < groundRow; py++) {
      setTile(arenaStart, py, 'BRIDGE_POST');
      setTile(arenaEnd, py, 'BRIDGE_POST');
    }

    // Helpful power-up block inside boss arena
    setTile(arenaStart + 6, groundRow - 5, 'MYSTERY', 'FIRE');
    setTile(arenaEnd - 6, groundRow - 5, 'MYSTERY', 'MUSHROOM');

    const bossTier = Math.floor(levelNumber / 2);
    const endlessBossTier = levelNumber > 100 ? Math.floor((levelNumber - 100) / 2) : 0;
    const maxHp =
      levelNumber <= 100
        ? Math.min(18, 3 + bossTier)
        : 18 + Math.min(32, endlessBossTier * 2);
    const speedScale =
      levelNumber <= 100
        ? 1 + Math.min(1.15, (bossTier - 1) * 0.08)
        : 2.15 + Math.min(1.45, endlessBossTier * 0.09);

    boss = {
      active: false,
      name: BOSS_NAMES[(bossTier - 1) % BOSS_NAMES.length],
      x: (arenaEnd - 6) * TILE_SIZE,
      y: (groundRow - 1) * TILE_SIZE - 56,
      w: 58,
      h: 56,
      vx: -90 * speedScale,
      vy: 0,
      dir: -1,
      hp: maxHp,
      maxHp,
      phase: 'PATROL',
      phaseTimer: 1.6,
      invulnTimer: 0,
      arenaLeft: (arenaStart + 1) * TILE_SIZE,
      arenaRight: (arenaEnd - 1) * TILE_SIZE,
      groundY: (groundRow - 1) * TILE_SIZE,
      onGround: true,
      speedScale,
    };

    flagpoleTileX = arenaEnd + 8;
  } else {
    // Classic Staircase Ascent before Flagpole
    const stairStart = finaleStart + 4;
    for (let step = 0; step < 6; step++) {
      for (let h = 0; h <= step; h++) {
        setTile(stairStart + step, groundRow - 1 - h, 'STONE_SOLID');
      }
    }
    flagpoleTileX = stairStart + 12;
  }

  const castleTileX = flagpoleTileX + 5;
  const castleW = 128;
  const castleH = 144;
  scenery.push({
    kind: 'CASTLE',
    x: castleTileX * TILE_SIZE,
    y: groundRow * TILE_SIZE - castleH,
    w: castleW,
    h: castleH,
    variant: 0,
  });

  const flagpole = {
    x: flagpoleTileX * TILE_SIZE + 12,
    topY: (groundRow - 9) * TILE_SIZE,
    bottomY: groundRow * TILE_SIZE,
    flagY: (groundRow - 9) * TILE_SIZE + 8,
    triggered: false,
  };

  return {
    levelNumber,
    theme,
    isBossLevel,
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE_SIZE,
    heightPx: heightTiles * TILE_SIZE,
    tiles,
    pulleys,
    movingPlatforms,
    crumblingPlatforms,
    currentZones,
    enemies,
    items,
    scenery,
    checkpoints,
    flagpole,
    castleX: castleTileX * TILE_SIZE + castleW / 2 - 12,
    castleY: groundRow * TILE_SIZE,
    bossArenaGateX,
    boss,
    spawnX: 3 * TILE_SIZE,
    spawnY: (groundRow - 2) * TILE_SIZE,
    heartBlockCount,
  };
}
