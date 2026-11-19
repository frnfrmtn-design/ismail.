import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SuperPixelQuestEngine } from './game/engine';
import { VIEW_HEIGHT, VIEW_WIDTH } from './game/sprites';
import { GameHUDState } from './game/types';

const INITIAL_HUD: GameHUDState = {
  status: 'TITLE_MENU',
  level: 1,
  isEndless: false,
  theme: 'LAND',
  score: 0,
  highScore: 0,
  coins: 0,
  hearts: 3,
  maxHearts: 10,
  timeRemaining: 300,
  powerUp: 'SMALL',
  isBossLevel: false,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 0,
  bossVulnerable: false,
  bannerMessage: null,
  respawnCountdown: 0,
  respawnReason: null,
  timerWasReset: false,
  levelProgressPct: 0,
  muted: false,
  savedRun: {
    hasSavedProgress: false,
    level: 1,
    hearts: 3,
    score: 0,
    coins: 0,
    highScore: 0,
  },
};

export default function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SuperPixelQuestEngine | null>(null);

  const [hud, setHud] = useState<GameHUDState>(INITIAL_HUD);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [portraitHintDismissed, setPortraitHintDismissed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const tryLockLandscape = useCallback(async () => {
    try {
      const orientation = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
        | undefined;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch {
      // Ignore errors on unsupported browsers or non-fullscreen contexts
    }
  }, []);

  // Detect touch device & portrait/landscape orientation responsively
  useEffect(() => {
    const updateViewportFlags = () => {
      if (typeof window === 'undefined') return;
      const isTouch =
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
      setShowTouchControls((prev) => prev || isTouch);
      setIsPortraitMobile(window.innerWidth < window.innerHeight && window.innerWidth < 900);
    };

    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);
    window.addEventListener('orientationchange', updateViewportFlags);
    return () => {
      window.removeEventListener('resize', updateViewportFlags);
      window.removeEventListener('orientationchange', updateViewportFlags);
    };
  }, []);

  // Sync fullscreen state & lock landscape when entering fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        void tryLockLandscape();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [tryLockLandscape]);

  // Initialize game engine
  useEffect(() => {
    const engine = new SuperPixelQuestEngine((nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    if (canvasRef.current) {
      engine.attachCanvas(canvasRef.current);
    }
    engine.startLoop();

    return () => {
      engine.stopLoop();
      engine.attachCanvas(null);
      engineRef.current = null;
    };
  }, []);

  // Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          engine.setKeyInput('left', true);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          engine.setKeyInput('right', true);
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          engine.setKeyInput('jump', true);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          engine.setKeyInput('sprint', true);
          break;
        case 'KeyF':
        case 'KeyZ':
        case 'Enter':
          if (hud.status === 'PLAYING') {
            e.preventDefault();
            engine.setKeyInput('fire', true);
          }
          break;
        case 'KeyP':
        case 'Escape':
          if (hud.status === 'PLAYING' || hud.status === 'PAUSED') {
            e.preventDefault();
            engine.togglePause();
          }
          break;
        case 'KeyM':
          e.preventDefault();
          engine.toggleMute();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          engine.setKeyInput('left', false);
          break;
        case 'ArrowRight':
        case 'KeyD':
          engine.setKeyInput('right', false);
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          engine.setKeyInput('jump', false);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          engine.setKeyInput('sprint', false);
          break;
        case 'KeyF':
        case 'KeyZ':
        case 'Enter':
          engine.setKeyInput('fire', false);
          break;
      }
    };

    const handleBlur = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setKeyInput('left', false);
      engine.setKeyInput('right', false);
      engine.setKeyInput('jump', false);
      engine.setKeyInput('sprint', false);
      engine.setKeyInput('fire', false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [hud.status]);

  const handleStartNew = useCallback(() => {
    void tryLockLandscape();
    engineRef.current?.startNewGame();
  }, [tryLockLandscape]);

  const handleContinue = useCallback(() => {
    void tryLockLandscape();
    engineRef.current?.continueSavedGame();
  }, [tryLockLandscape]);

  const handleRetryLevel = useCallback(() => {
    void tryLockLandscape();
    engineRef.current?.retryCurrentLevel();
  }, [tryLockLandscape]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = viewportRef.current;
        if (el && typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen();
        }
        await tryLockLandscape();
      } else if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection on unsupported browsers
    }
  }, [tryLockLandscape]);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const bindTouchAction = (action: 'left' | 'right' | 'jump' | 'fire') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      engineRef.current?.setKeyInput(action, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setKeyInput(action, false);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setKeyInput(action, false);
    },
  });

  const renderTouchControls = (dockedBelowCanvas: boolean) => (
    <div
      className={
        dockedBelowCanvas
          ? 'mt-3 flex w-full max-w-[1280px] items-center justify-between px-2'
          : 'pointer-events-none absolute inset-x-0 bottom-2.5 sm:bottom-3 z-20 flex items-end justify-between px-3 sm:px-4'
      }
    >
      {/* Bottom-Left D-Pad */}
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          aria-label="Move Left"
          {...bindTouchAction('left')}
          className="touch-none select-none flex h-12 w-12 sm:h-15 sm:w-15 items-center justify-center border-2 border-white/40 bg-neutral-950/70 text-white text-lg sm:text-xl font-bold active:bg-white/30"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Move Right"
          {...bindTouchAction('right')}
          className="touch-none select-none flex h-12 w-12 sm:h-15 sm:w-15 items-center justify-center border-2 border-white/40 bg-neutral-950/70 text-white text-lg sm:text-xl font-bold active:bg-white/30"
        >
          ▶
        </button>
      </div>

      {/* Bottom-Right Action Buttons */}
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          aria-label="Fireball"
          {...bindTouchAction('fire')}
          className="touch-none select-none flex h-12 w-14 sm:h-15 sm:w-18 items-center justify-center border-2 border-orange-400/70 bg-orange-600/70 font-pixel text-[10px] text-white active:bg-orange-500"
        >
          FIRE
        </button>
        <button
          type="button"
          aria-label="Jump or Swim"
          {...bindTouchAction('jump')}
          className="touch-none select-none flex h-12 w-16 sm:h-15 sm:w-20 items-center justify-center border-2 border-emerald-300/70 bg-emerald-600/70 font-pixel text-[10px] text-white active:bg-emerald-500"
        >
          JUMP
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={viewportRef}
      className="relative flex h-dvh w-screen flex-col items-center justify-center bg-neutral-950 p-1.5 sm:p-3 overflow-hidden"
    >
      {/* Non-intrusive dismissible Landscape Hint on narrow portrait mobile screens */}
      {isPortraitMobile && !portraitHintDismissed && !isFullscreen && (
        <div className="mb-2 flex w-full max-w-[1280px] items-center justify-between gap-2 border border-amber-400/60 bg-neutral-900/95 px-3 py-1.5 text-[11px] text-amber-200">
          <span className="inline-flex items-center gap-2">
            <RotateCw className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>Rotate device to Landscape for the best view</span>
          </span>
          <button
            type="button"
            onClick={() => setPortraitHintDismissed(true)}
            aria-label="Dismiss landscape rotation hint"
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main 16:9 Retro Arcade Viewport proportioned for wide horizontal screens */}
      <div
        className={`relative flex aspect-video items-center justify-center bg-black border-2 border-neutral-800 shadow-2xl overflow-hidden ${
          isFullscreen
            ? 'w-[min(100vw,calc(100dvh*16/9))]'
            : 'w-[min(100%,calc((100dvh-16px)*16/9),1280px)]'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          className="h-full w-full pixelated block"
        />

        {/* Top-Right Compact Utility Controls (Touch Pad, Mute, Fullscreen, Pause) */}
        <div className="absolute top-1.5 right-2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowTouchControls((prev) => !prev)}
            title="Toggle On-Screen Touch Controls"
            aria-label="Toggle On-Screen Touch Controls"
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-yellow-400 ${
              showTouchControls
                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                : 'border-neutral-700 bg-neutral-900/85 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            title={hud.muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-neutral-700 bg-neutral-900/85 text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            {hud.muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Landscape Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-neutral-700 bg-neutral-900/85 text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4 text-amber-300" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {(hud.status === 'PLAYING' || hud.status === 'PAUSED') && (
            <button
              type="button"
              onClick={handleTogglePause}
              title={hud.status === 'PAUSED' ? 'Resume Game (P)' : 'Pause Game (P)'}
              aria-label={hud.status === 'PAUSED' ? 'Resume Game' : 'Pause Game'}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center border border-neutral-700 bg-neutral-900/85 text-neutral-200 hover:bg-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              {hud.status === 'PAUSED' ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* TITLE SCREEN OVERLAY */}
        {hud.status === 'TITLE_MENU' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/75 p-2 sm:p-5">
            <div className="w-full max-w-2xl max-h-[calc(100%-8px)] overflow-y-auto border-4 border-amber-400 bg-neutral-950/95 p-3.5 sm:p-6 text-center shadow-2xl">
              <p className="font-pixel text-[9px] sm:text-xs text-amber-300 tracking-wider mb-1.5 sm:mb-2.5">
                100 CAMPAIGN LEVELS · ENDLESS CHAMPIONSHIP 101+
              </p>

              <h1 className="font-pixel text-lg sm:text-3xl md:text-4xl text-white leading-tight tracking-tight mb-1.5 sm:mb-2">
                SUPER PIXEL QUEST
              </h1>

              <p className="text-[11px] sm:text-sm text-neutral-300 max-w-lg mx-auto mb-3 sm:mb-5 leading-relaxed">
                Sprint across expansive retro worlds, ride counterweight pulleys, swim underwater reefs, and outsmart armored mini-bosses before the 5:00 clock runs out.
              </p>

              {/* High Score & Rules Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 border-y border-neutral-800 py-2.5 sm:py-4 mb-3 sm:mb-5 text-left">
                <div>
                  <div className="font-pixel text-[9px] sm:text-[10px] text-red-400 mb-1">CARRY-FORWARD HEARTS</div>
                  <p className="text-[11px] sm:text-xs text-neutral-300 leading-snug">
                    Start with 3 Hearts. Collect up to 10 across levels. Hit 0 Hearts and retry from the 0% start of that level.
                  </p>
                </div>
                <div>
                  <div className="font-pixel text-[9px] sm:text-[10px] text-amber-400 mb-1">STRICT 5:00 TIMER</div>
                  <p className="text-[11px] sm:text-xs text-neutral-300 leading-snug">
                    Each stage gives 5:00. Running out deducts 1 Heart and resets the clock if Hearts remain.
                  </p>
                </div>
                <div>
                  <div className="font-pixel text-[9px] sm:text-[10px] text-sky-400 mb-1">MINI-BOSSES</div>
                  <p className="text-[11px] sm:text-xs text-neutral-300 leading-snug">
                    Every 2nd level ends with an armored boss. Dodge slams and strike its exposed core.
                  </p>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="flex flex-wrap items-stretch justify-center gap-3 mb-5">
                {hud.savedRun.hasSavedProgress ? (
                  <>
                    <button
                      type="button"
                      onClick={handleContinue}
                      className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 text-white px-6 py-3 border-2 border-emerald-300 transition-colors cursor-pointer"
                    >
                      <span className="font-pixel text-xs sm:text-sm whitespace-nowrap">
                        CONTINUE GAME
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-2 font-mono-tabular text-[11px] text-emerald-100 whitespace-nowrap">
                        <span>LVL {String(hud.savedRun.level).padStart(2, '0')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3 fill-red-400 text-red-200" />
                          {hud.savedRun.hearts}/{hud.maxHearts}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>SCORE {String(hud.savedRun.score).padStart(6, '0')}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartNew}
                      className="flex items-center justify-center font-pixel text-xs sm:text-sm bg-red-600 hover:bg-red-500 active:translate-y-0.5 text-white px-6 py-3.5 border-2 border-red-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      NEW GAME
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="font-pixel text-xs sm:text-sm bg-red-600 hover:bg-red-500 active:translate-y-0.5 text-white px-8 py-3.5 border-2 border-red-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    START GAME
                  </button>
                )}
              </div>

              {/* Controls & Top Score */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-neutral-400 font-mono-tabular">
                <span>HIGH SCORE: {String(hud.highScore).padStart(6, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>MOVE: A/D or ARROWS</span>
                <span aria-hidden="true">·</span>
                <span>JUMP/SWIM: SPACE/W</span>
                <span aria-hidden="true">·</span>
                <span>SPRINT: SHIFT</span>
                <span aria-hidden="true">·</span>
                <span>FIRE: F/Z</span>
              </div>
            </div>
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {hud.status === 'PAUSED' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/75 p-2 sm:p-4">
            <div className="w-full max-w-md max-h-[calc(100%-8px)] overflow-y-auto border-4 border-neutral-400 bg-neutral-950 p-4 sm:p-6 text-center shadow-2xl">
              <h2 className="font-pixel text-lg sm:text-xl text-white mb-2">PAUSED</h2>
              <p className="text-xs text-neutral-400 mb-4 sm:mb-6 font-mono-tabular">
                LEVEL {String(hud.level).padStart(2, '0')} · PROGRESS {hud.levelProgressPct}% · HEARTS {hud.hearts}/{hud.maxHearts}
              </p>

              <div className="flex flex-col gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="font-pixel text-xs bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 sm:py-3 px-4 border-2 border-emerald-300 cursor-pointer"
                >
                  RESUME
                </button>
                <button
                  type="button"
                  onClick={handleRetryLevel}
                  className="font-pixel text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-100 py-2.5 sm:py-3 px-4 border-2 border-neutral-600 cursor-pointer"
                >
                  RESTART LEVEL {String(hud.level).padStart(2, '0')}
                </button>
                <button
                  type="button"
                  onClick={handleReturnTitle}
                  className="font-pixel text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 py-2.5 sm:py-3 px-4 border border-neutral-700 cursor-pointer"
                >
                  TITLE SCREEN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6-SECOND REVERSE COUNTDOWN OVERLAY (WHEN LOSING 1 HEART WITH HEARTS > 0) */}
        {hud.status === 'HEART_COUNTDOWN' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/78 p-2 sm:p-4">
            <div className="w-full max-w-md max-h-[calc(100%-8px)] overflow-y-auto border-4 border-amber-400 bg-neutral-950/95 p-4 sm:p-8 text-center shadow-2xl">
              <p className="font-pixel text-xs text-red-400 mb-2 sm:mb-3">
                {hud.respawnReason ?? 'LOST 1 HEART!'}
              </p>

              <div className="font-pixel text-4xl sm:text-6xl text-amber-300 my-2.5 sm:my-4 tabular-nums">
                {hud.respawnCountdown}
              </div>

              <p className="font-pixel text-[11px] text-white mb-2 sm:mb-3">
                HEARTS REMAINING: {hud.hearts} / {hud.maxHearts}
              </p>

              {hud.timerWasReset && (
                <p className="font-pixel text-[10px] text-sky-300 mb-2">
                  STAGE TIMER RESET TO 05:00
                </p>
              )}

              <p className="text-xs text-neutral-300">
                Resuming at safe respawn spot in {hud.respawnCountdown}...
              </p>
            </div>
          </div>
        )}

        {/* OUT OF HEARTS — LEVEL FAILED OVERLAY */}
        {hud.status === 'LEVEL_FAILED' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/85 p-2 sm:p-4">
            <div className="w-full max-w-lg max-h-[calc(100%-8px)] overflow-y-auto border-4 border-red-500 bg-neutral-950 p-4 sm:p-8 text-center shadow-2xl">
              <p className="font-pixel text-xs text-red-400 mb-1.5 sm:mb-2">0 HEARTS REMAINING</p>
              <h2 className="font-pixel text-base sm:text-2xl text-white leading-snug mb-3 sm:mb-4">
                OUT OF HEARTS — LEVEL FAILED
              </h2>

              <div className="flex items-center justify-center gap-4 text-xs text-neutral-300 font-mono-tabular border-y border-neutral-800 py-3 mb-6">
                <span>LEVEL {String(hud.level).padStart(2, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>SCORE {String(hud.score).padStart(6, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>REACHED {hud.levelProgressPct}%</span>
              </div>

              <p className="text-xs text-neutral-400 mb-6">
                Retrying restarts from the 0% start line of Level {hud.level} with 3 fresh Hearts and a full 5:00 timer.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRetryLevel}
                  className="inline-flex items-center gap-2 font-pixel text-xs sm:text-sm bg-red-600 hover:bg-red-500 text-white px-6 py-3.5 border-2 border-red-300 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  RETRY LEVEL {hud.level}
                </button>

                <button
                  type="button"
                  onClick={handleReturnTitle}
                  className="font-pixel text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-5 py-3.5 border border-neutral-700 cursor-pointer whitespace-nowrap"
                >
                  TITLE SCREEN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE / TOUCH ON-SCREEN CONTROLS (INSIDE VIEWPORT IN LANDSCAPE OR FULLSCREEN) */}
        {showTouchControls && hud.status === 'PLAYING' && (!isPortraitMobile || isFullscreen) &&
          renderTouchControls(false)}
      </div>

      {/* MOBILE / TOUCH ON-SCREEN CONTROLS (BELOW CANVAS ON NARROW PORTRAIT SCREENS) */}
      {showTouchControls && hud.status === 'PLAYING' && isPortraitMobile && !isFullscreen &&
        renderTouchControls(true)}
    </div>
  );
}
