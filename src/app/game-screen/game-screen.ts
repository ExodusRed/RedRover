import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COLS, Game, Hud, ROWS } from '../game/game';
import { ScoreEntry, fetchTopScores, saveName, savedName, submitScore } from '../game/leaderboard';
import { Point } from '../game/maze';
import { Renderer } from '../game/renderer';
import { Sound } from '../game/sound';
import { ScoreTable } from '../score-table/score-table';

const KEY_DIRS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

type SubmitState = 'idle' | 'sending' | 'done' | 'error';

@Component({
  selector: 'game-screen',
  imports: [RouterLink, ScoreTable],
  templateUrl: './game-screen.html',
  styleUrl: './game-screen.css',
})
export class GameScreen implements AfterViewInit, OnDestroy {
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stageRef = viewChild.required<ElementRef<HTMLElement>>('stage');

  // Tall board on portrait screens (phones), wide board otherwise.
  readonly game = innerHeight > innerWidth * 1.1 ? new Game(13, 21) : new Game(COLS, ROWS);
  readonly hud = signal<Hud>(this.game.hud());

  readonly sound = new Sound();
  readonly muted = signal(this.sound.muted);

  // Leaderboard (shown on game over)
  readonly playerName = signal(savedName());
  readonly submitState = signal<SubmitState>('idle');
  readonly submitError = signal('');
  readonly rank = signal<number | null>(null);
  readonly topScores = signal<ScoreEntry[] | null>(null);

  private renderer: Renderer | null = null;
  private tile = 32;
  private frame = 0;
  private lastTime = 0;
  private touchStart: { x: number; y: number } | null = null;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const ctx = this.canvasRef().nativeElement.getContext('2d');
    if (!ctx) return; // e.g. in unit tests without a real canvas
    this.renderer = new Renderer(ctx);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stageRef().nativeElement);
    this.resize();

    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // clamp so a background tab doesn't teleport things
    this.lastTime = now;
    this.game.update(dt);
    this.sound.play(this.game.drainEvents());
    this.renderer?.draw(this.game, this.tile);
    this.syncHud();
    this.frame = requestAnimationFrame(this.loop);
  };

  /** Only push HUD values into Angular when something visible actually changed. */
  private syncHud(): void {
    const next = this.game.hud();
    const cur = this.hud();
    if (!(Object.keys(next) as (keyof Hud)[]).some((k) => next[k] !== cur[k])) return;
    this.hud.set(next);
    if (next.state === 'over' && cur.state !== 'over') this.onGameOver();
    if (cur.state === 'over' && next.state !== 'over') this.resetLeaderboard();
  }

  /** Fit the board into the available space, keeping tiles whole pixels. */
  private resize(): void {
    const stage = this.stageRef().nativeElement;
    const canvas = this.canvasRef().nativeElement;
    this.tile = Math.max(8, Math.floor(Math.min(stage.clientWidth / this.game.cols, stage.clientHeight / this.game.rows)));
    const width = this.game.cols * this.tile;
    const height = this.game.rows * this.tile;
    const dpr = devicePixelRatio || 1;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ------------------------------------------------------------- leaderboard

  private onGameOver(): void {
    this.topScores.set(null);
    fetchTopScores()
      .then((top) => this.topScores.set(top))
      .catch(() => this.topScores.set([]));
  }

  private resetLeaderboard(): void {
    this.submitState.set('idle');
    this.submitError.set('');
    this.rank.set(null);
  }

  async submit(): Promise<void> {
    const name = this.playerName().trim();
    if (!name || this.submitState() === 'sending' || this.submitState() === 'done') return;
    this.submitState.set('sending');
    saveName(name);
    try {
      const result = await submitScore(name, this.hud().score, this.hud().level);
      this.rank.set(result.rank);
      this.topScores.set(result.top);
      this.submitState.set('done');
    } catch (e) {
      this.submitError.set(e instanceof Error ? e.message : 'Something went wrong');
      this.submitState.set('error');
    }
  }

  restart(): void {
    this.game.action();
  }

  toggleMute(): void {
    this.sound.unlock();
    this.muted.set(this.sound.toggleMute());
  }

  // ------------------------------------------------------------- input

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    // Let the player type their name without steering the rover.
    if (e.target instanceof HTMLInputElement) return;
    this.sound.unlock();

    const dir = KEY_DIRS[e.code];
    if (dir) {
      this.game.steer(dir);
    } else if (e.code === 'Space' || e.code === 'Enter') {
      this.game.action();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      this.game.togglePause();
    } else if (e.code === 'KeyM') {
      this.toggleMute();
    } else {
      return;
    }
    e.preventDefault(); // stop arrow keys / space from scrolling the page
  }

  onTouchStart(e: TouchEvent): void {
    this.sound.unlock();
    const t = e.changedTouches[0];
    this.touchStart = { x: t.clientX, y: t.clientY };
  }

  onTouchMove(e: TouchEvent): void {
    // Steer as soon as the finger has moved far enough — feels more responsive than waiting for touchend.
    if (!this.touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    if (Math.hypot(dx, dy) < 24) return;
    this.game.steer(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
    this.touchStart = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }

  onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    const tapped = this.touchStart && Math.hypot(t.clientX - this.touchStart.x, t.clientY - this.touchStart.y) < 10;
    // On the game-over screen, taps are for the name form and buttons, not for restarting.
    if (tapped && this.game.state !== 'over') this.game.action();
    this.touchStart = null;
  }

  pad(dir: Point): void {
    this.sound.unlock();
    this.game.steer(dir);
  }
}
