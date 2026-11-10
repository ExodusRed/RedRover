// RedRover game logic — no Angular, no rendering. Just state and rules.

import { DIRS, Point, Rng, Walls, distanceMap, floorTiles, generateMaze, isFloor, seededRng } from './maze';

/** Default board size (landscape). Portrait screens use a tall board instead. */
export const COLS = 21;
export const ROWS = 15;

export type GameState = 'ready' | 'playing' | 'hit' | 'clear' | 'paused' | 'over';
export type DroneKind = 'hunter' | 'interceptor' | 'patroller';

/** Something that moves tile-to-tile with smooth interpolation. */
export interface Mover {
  from: Point; // tile we are leaving
  to: Point; // tile we are heading to (equal to `from` when standing still)
  progress: number; // 0..1 between from and to
  dir: Point;
  speed: number; // tiles per second
}

export interface Drone extends Mover {
  kind: DroneKind;
  releaseIn: number; // seconds until it leaves the dock
  patrolTarget: Point;
}

export interface Hud {
  state: GameState;
  score: number;
  highScore: number;
  level: number;
  lives: number;
  cellsLeft: number;
  emp: number; // seconds of EMP remaining
}

const DRONE_ORDER: DroneKind[] = ['hunter', 'interceptor', 'patroller', 'hunter'];
const HIGH_SCORE_KEY = 'redrover.highscore';

export class Game {
  state: GameState = 'ready';
  level = 1;
  score = 0;
  lives = 3;
  highScore = loadHighScore();

  walls: Walls = [];
  cells = new Set<string>(); // energy cells, keyed "x,y"
  emps = new Set<string>(); // EMP charges
  rover!: Mover;
  drones: Drone[] = [];
  dock: Point = { x: 0, y: 0 };
  roverStart: Point = { x: 0, y: 0 };

  empTime = 0; // seconds drones stay offline
  empChain = 0; // drones knocked out during the current EMP
  stateTime = 0; // seconds since the state last changed
  time = 0; // total running time, for animations

  /** Floating "+200" style texts. */
  popups: { x: number; y: number; text: string; age: number }[] = [];

  private wanted: Point | null = null;
  private rng: Rng = Math.random;

  constructor(
    readonly cols = COLS,
    readonly rows = ROWS,
  ) {
    this.newGame();
  }

  // ---------------------------------------------------------------- setup

  newGame(): void {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.buildLevel();
  }

  private buildLevel(): void {
    this.rng = seededRng((Math.random() * 2 ** 32) >>> 0);
    this.walls = generateMaze(this.cols, this.rows, this.rng, Math.min(0.06 + this.level * 0.02, 0.16));

    // Rover starts bottom-left; the drone dock is the tile farthest away from it.
    this.roverStart = { x: 1, y: this.rows - 2 };
    const fromStart = distanceMap(this.walls, this.roverStart);
    const tiles = floorTiles(this.walls);
    this.dock = tiles.reduce((best, t) => (fromStart[t.y][t.x] > fromStart[best.y][best.x] ? t : best));

    // Energy cells everywhere except right next to the start and the dock.
    const fromDock = distanceMap(this.walls, this.dock);
    this.cells = new Set(tiles.filter((t) => fromStart[t.y][t.x] > 1 && fromDock[t.y][t.x] > 2).map(key));

    // Four EMP charges, one in each quadrant, picked far from the start.
    this.emps.clear();
    const quadrants = [
      (t: Point) => t.x < this.cols / 2 && t.y < this.rows / 2,
      (t: Point) => t.x >= this.cols / 2 && t.y < this.rows / 2,
      (t: Point) => t.x < this.cols / 2 && t.y >= this.rows / 2,
      (t: Point) => t.x >= this.cols / 2 && t.y >= this.rows / 2,
    ];
    for (const inQuadrant of quadrants) {
      const candidates = tiles.filter((t) => inQuadrant(t) && this.cells.has(key(t)) && fromStart[t.y][t.x] > 6);
      if (!candidates.length) continue;
      const t = candidates[Math.floor(this.rng() * candidates.length)];
      this.cells.delete(key(t));
      this.emps.add(key(t));
    }

    this.resetPositions();
    this.setState('ready');
  }

  /** Puts rover and drones back to their start positions (after a hit or a new level). */
  private resetPositions(): void {
    this.rover = mover(this.roverStart, 5);
    const count = Math.min(2 + Math.floor((this.level - 1) / 1.5), 4);
    const droneSpeed = Math.min(3.4 + this.level * 0.2, 4.6);
    this.drones = DRONE_ORDER.slice(0, count).map((kind, i) => ({
      ...mover(this.dock, kind === 'patroller' ? droneSpeed * 0.9 : droneSpeed),
      kind,
      releaseIn: 1 + i * 3,
      patrolTarget: this.randomFloor(),
    }));
    this.empTime = 0;
    this.wanted = null;
  }

  // ---------------------------------------------------------------- input

  /** Player wants to steer in a direction (buffered until it's possible). */
  steer(dir: Point): void {
    this.wanted = dir;
    if (this.state === 'ready') this.setState('playing');
  }

  /** Space / Enter / tap: start, continue or restart. */
  action(): void {
    if (this.state === 'ready') this.setState('playing');
    else if (this.state === 'paused') this.setState('playing');
    else if (this.state === 'clear' && this.stateTime > 0.8) {
      this.level++;
      this.buildLevel();
    } else if (this.state === 'over' && this.stateTime > 0.8) this.newGame();
  }

  togglePause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    this.stateTime += dt;
    this.popups.forEach((p) => (p.age += dt));
    this.popups = this.popups.filter((p) => p.age < 1);

    if (this.state === 'hit' && this.stateTime > 1.6) {
      if (this.lives > 0) {
        this.resetPositions();
        this.setState('ready');
      } else {
        this.setState('over');
      }
    }
    if (this.state !== 'playing') return;

    this.empTime = Math.max(0, this.empTime - dt);
    if (this.empTime === 0) this.empChain = 0;

    this.moveRover(dt);
    for (const d of this.drones) this.moveDrone(d, dt);
    this.checkCollisions();

    if (this.cells.size === 0) {
      this.addScore(500 * this.level);
      this.setState('clear');
    }
  }

  private moveRover(dt: number): void {
    const r = this.rover;
    const w = this.wanted;

    // Instant turn-around while between tiles.
    if (w && moving(r) && w.x === -r.dir.x && w.y === -r.dir.y) {
      [r.from, r.to] = [r.to, r.from];
      r.progress = 1 - r.progress;
      r.dir = w;
    }

    if (moving(r)) {
      r.progress += r.speed * dt;
      if (r.progress < 1) return;
      const leftover = (r.progress - 1) / r.speed;
      r.from = r.to;
      r.progress = 0;
      this.arrive(r.from);
      this.chooseRoverStep();
      if (moving(r)) r.progress = Math.min(leftover * r.speed, 0.99);
    } else {
      this.chooseRoverStep();
    }
  }

  /** At a tile: take the wanted direction if open, otherwise keep going straight. */
  private chooseRoverStep(): void {
    const r = this.rover;
    for (const d of [this.wanted, r.dir]) {
      if (d && (d.x || d.y) && isFloor(this.walls, r.from.x + d.x, r.from.y + d.y)) {
        r.dir = d;
        r.to = { x: r.from.x + d.x, y: r.from.y + d.y };
        return;
      }
    }
    r.to = r.from; // blocked: stop
  }

  /** Rover reached a tile: pick up whatever is there. */
  private arrive(t: Point): void {
    const k = key(t);
    if (this.cells.delete(k)) this.addScore(10);
    if (this.emps.delete(k)) {
      this.addScore(50);
      this.empTime = Math.max(3, 7 - this.level * 0.4);
      this.empChain = 0;
    }
  }

  private moveDrone(d: Drone, dt: number): void {
    if (d.releaseIn > 0) {
      d.releaseIn -= dt;
      return;
    }
    if (this.empTime > 0) return; // offline: frozen in place

    if (!moving(d)) this.chooseDroneStep(d);
    if (!moving(d)) return;
    d.progress += d.speed * dt;
    if (d.progress >= 1) {
      d.from = d.to;
      d.progress = 0;
      this.chooseDroneStep(d);
    }
  }

  /**
   * Drone AI: pick the neighbouring tile that is closest (by BFS) to the drone's target.
   * Drones don't reverse unless they have to, which makes them feel like they're patrolling.
   */
  private chooseDroneStep(d: Drone): void {
    const target = this.droneTarget(d);
    const dist = distanceMap(this.walls, target);
    let options = DIRS.filter((dir) => isFloor(this.walls, d.from.x + dir.x, d.from.y + dir.y));
    const forward = options.filter((dir) => !(dir.x === -d.dir.x && dir.y === -d.dir.y));
    if (forward.length) options = forward;
    if (!options.length) return;

    const score = (dir: Point) => {
      const v = dist[d.from.y + dir.y][d.from.x + dir.x];
      return v < 0 ? Infinity : v;
    };
    const best = Math.min(...options.map(score));
    const choices = options.filter((dir) => score(dir) === best);
    const dir = choices[Math.floor(this.rng() * choices.length)];
    d.dir = dir;
    d.to = { x: d.from.x + dir.x, y: d.from.y + dir.y };
  }

  private droneTarget(d: Drone): Point {
    const rover = this.roverTile();
    switch (d.kind) {
      case 'hunter':
        return rover;
      case 'interceptor': {
        // Aim up to 4 tiles ahead of the rover to cut it off.
        let t = rover;
        for (let i = 0; i < 4; i++) {
          const n = { x: t.x + this.rover.dir.x, y: t.y + this.rover.dir.y };
          if (!isFloor(this.walls, n.x, n.y)) break;
          t = n;
        }
        return t;
      }
      case 'patroller': {
        // Wanders between random points, but gives chase when the rover gets close.
        const near = distanceMap(this.walls, d.from)[rover.y][rover.x];
        if (near >= 0 && near <= 7) return rover;
        if (d.from.x === d.patrolTarget.x && d.from.y === d.patrolTarget.y) d.patrolTarget = this.randomFloor();
        return d.patrolTarget;
      }
    }
  }

  private checkCollisions(): void {
    const rp = position(this.rover);
    for (const d of this.drones) {
      if (d.releaseIn > 0 && this.empTime === 0) continue; // docked drones are harmless
      const dp = position(d);
      if (Math.hypot(rp.x - dp.x, rp.y - dp.y) > 0.7) continue;

      if (this.empTime > 0) {
        // Ram an offline drone: it gets sent back to the dock for a reboot.
        this.empChain++;
        const points = 200 * 2 ** (this.empChain - 1);
        this.addScore(points);
        this.popups.push({ x: dp.x, y: dp.y, text: `+${points}`, age: 0 });
        Object.assign(d, mover(this.dock, d.speed), { releaseIn: 3 });
      } else {
        this.lives--;
        this.setState('hit');
        return;
      }
    }
  }

  // ---------------------------------------------------------------- helpers

  roverTile(): Point {
    return this.rover.progress > 0.5 ? this.rover.to : this.rover.from;
  }

  hud(): Hud {
    return {
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      cellsLeft: this.cells.size,
      emp: Math.ceil(this.empTime),
    };
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.score);
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private randomFloor(): Point {
    const tiles = floorTiles(this.walls);
    return tiles[Math.floor(this.rng() * tiles.length)];
  }
}

// -------------------------------------------------------------------- utils

export const key = (p: Point) => `${p.x},${p.y}`;

export function moving(m: Mover): boolean {
  return m.from.x !== m.to.x || m.from.y !== m.to.y;
}

/** Interpolated position in tile units, for rendering and collisions. */
export function position(m: Mover): Point {
  return { x: m.from.x + (m.to.x - m.from.x) * m.progress, y: m.from.y + (m.to.y - m.from.y) * m.progress };
}

function mover(at: Point, speed: number): Mover {
  return { from: { ...at }, to: { ...at }, progress: 0, dir: { x: 0, y: 0 }, speed };
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* storage unavailable (private mode) — high score just won't persist */
  }
}
