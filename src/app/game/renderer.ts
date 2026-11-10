// Draws the game state onto a canvas. Pure drawing — no game rules in here.

import { Drone, Game, position } from './game';

const C = {
  ground: '#1f0f0b',
  groundDot: '#2a1510',
  wall: '#a8432b',
  wallTop: '#c8573a',
  wallEdge: '#6e2618',
  cell: '#5eead4',
  emp: '#60a5fa',
  rover: '#eaeaea',
  roverWheel: '#4a4a52',
  beacon: '#e5383b',
  offline: '#6b6b75',
  text: '#ffffff',
};

const DRONE_COLORS: Record<Drone['kind'], string> = {
  hunter: '#e5383b',
  interceptor: '#f59e0b',
  patroller: '#c084fc',
};

export class Renderer {
  private wallLayer: HTMLCanvasElement | null = null;
  private wallLayerFor: unknown = null;
  private wallLayerSize = 0;

  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(game: Game, tile: number): void {
    const ctx = this.ctx;
    const t = game.time;

    ctx.drawImage(this.walls(game, tile), 0, 0, game.cols * tile, game.rows * tile);

    // Energy cells: small pulsing diamonds.
    ctx.fillStyle = C.cell;
    for (const k of game.cells) {
      const [x, y] = k.split(',').map(Number);
      const s = tile * (0.11 + 0.02 * Math.sin(t * 4 + x + y));
      ctx.save();
      ctx.translate((x + 0.5) * tile, (y + 0.5) * tile);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }

    // EMP charges: glowing rings.
    for (const k of game.emps) {
      const [x, y] = k.split(',').map(Number);
      const cx = (x + 0.5) * tile;
      const cy = (y + 0.5) * tile;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.strokeStyle = C.emp;
      ctx.lineWidth = tile * 0.08;
      ctx.globalAlpha = 0.4 + 0.6 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * (0.22 + 0.06 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.emp;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dock marker.
    ctx.strokeStyle = '#e5383b55';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(game.dock.x * tile + 3, game.dock.y * tile + 3, tile - 6, tile - 6);
    ctx.setLineDash([]);

    for (const d of game.drones) this.drawDrone(d, game, tile);
    this.drawRover(game, tile);

    // Score popups.
    ctx.font = `bold ${Math.round(tile * 0.45)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const p of game.popups) {
      ctx.globalAlpha = 1 - p.age;
      ctx.fillStyle = C.text;
      ctx.fillText(p.text, (p.x + 0.5) * tile, (p.y + 0.3 - p.age * 0.6) * tile);
    }
    ctx.globalAlpha = 1;

    // EMP screen tint.
    if (game.empTime > 0) {
      ctx.fillStyle = `rgba(96, 165, 250, ${0.06 + 0.03 * Math.sin(t * 10)})`;
      ctx.fillRect(0, 0, game.cols * tile, game.rows * tile);
    }
  }

  private drawRover(game: Game, tile: number): void {
    const ctx = this.ctx;
    const p = position(game.rover);
    const cx = (p.x + 0.5) * tile;
    const cy = (p.y + 0.5) * tile;

    if (game.state === 'hit') {
      // Explosion: expanding sparks.
      const k = Math.min(game.stateTime / 0.8, 1);
      ctx.fillStyle = `rgba(229, 56, 59, ${1 - k})`;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = tile * (0.2 + k * 0.9);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, tile * 0.08 * (1 - k) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (k < 1) return;
    }

    const d = game.rover.dir;
    const angle = d.x || d.y ? Math.atan2(d.y, d.x) : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const s = tile;
    // wheels
    ctx.fillStyle = C.roverWheel;
    for (const [wx, wy] of [[-0.22, -0.3], [0.18, -0.3], [-0.22, 0.3], [0.18, 0.3]]) {
      ctx.beginPath();
      ctx.arc(wx * s, wy * s, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // body
    ctx.fillStyle = C.rover;
    roundRect(ctx, -0.32 * s, -0.22 * s, 0.6 * s, 0.44 * s, s * 0.08);
    ctx.fill();
    // solar panel stripe
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(-0.24 * s, -0.12 * s, 0.3 * s, 0.24 * s);
    // camera mast + blinking beacon at the front
    ctx.fillStyle = C.beacon;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.time * 8);
    ctx.beginPath();
    ctx.arc(0.2 * s, 0, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawDrone(d: Drone, game: Game, tile: number): void {
    const ctx = this.ctx;
    const p = position(d);
    const cx = (p.x + 0.5) * tile;
    const cy = (p.y + 0.5) * tile;
    const offline = game.empTime > 0;
    // Flicker during the last 1.5 seconds of the EMP as a warning.
    const warn = offline && game.empTime < 1.5 && Math.floor(game.time * 8) % 2 === 0;
    const color = offline && !warn ? C.offline : DRONE_COLORS[d.kind];
    const docked = d.releaseIn > 0;
    const hover = offline ? 0 : Math.sin(game.time * 6 + p.x) * tile * 0.04;

    ctx.save();
    ctx.translate(cx, cy + hover);
    ctx.globalAlpha = docked ? 0.45 : 1;
    // rotors
    const spin = offline ? 0 : game.time * 30;
    ctx.strokeStyle = '#8a8a92';
    ctx.lineWidth = Math.max(1.5, tile * 0.05);
    for (const sx of [-1, 1]) {
      const rx = sx * tile * 0.3;
      const ry = -tile * 0.22;
      const len = tile * 0.15 * Math.abs(Math.cos(spin + sx));
      ctx.beginPath();
      ctx.moveTo(rx - len, ry);
      ctx.lineTo(rx + len, ry);
      ctx.stroke();
    }
    // body
    ctx.fillStyle = '#26262c';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, tile * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, tile * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // eye looks in the moving direction
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(d.dir.x * tile * 0.08, d.dir.y * tile * 0.08, tile * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Walls only change once per level, so they're drawn once to an offscreen canvas. */
  private walls(game: Game, tile: number): HTMLCanvasElement {
    const scale = devicePixelRatio || 1;
    if (this.wallLayer && this.wallLayerFor === game.walls && this.wallLayerSize === tile * scale) return this.wallLayer;

    const layer = document.createElement('canvas');
    layer.width = game.cols * tile * scale;
    layer.height = game.rows * tile * scale;
    const ctx = layer.getContext('2d')!;
    ctx.scale(scale, scale);

    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, game.cols * tile, game.rows * tile);
    // a little dusty texture
    ctx.fillStyle = C.groundDot;
    for (let i = 0; i < game.cols * game.rows * 2; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 12345.6789) % 1;
      ctx.fillRect(Math.abs(x) * game.cols * tile, Math.abs(y) * game.rows * tile, 2, 2);
    }

    // Walls are drawn as connected blocks: a lit top edge where open floor is above,
    // and a shadowed "front face" where open floor is below — gives a slight 3D look.
    const floorAt = (x: number, y: number) => y >= 0 && y < game.rows && x >= 0 && x < game.cols && !game.walls[y][x];
    game.walls.forEach((row, y) =>
      row.forEach((wall, x) => {
        if (!wall) return;
        const px = x * tile;
        const py = y * tile;
        ctx.fillStyle = C.wall;
        ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
        if (floorAt(x, y - 1)) {
          ctx.fillStyle = C.wallTop;
          ctx.fillRect(px, py, tile + 0.5, tile * 0.16);
        }
        if (floorAt(x, y + 1)) {
          ctx.fillStyle = C.wallEdge;
          ctx.fillRect(px, py + tile * 0.72, tile + 0.5, tile * 0.28);
        }
        if (floorAt(x - 1, y)) {
          ctx.fillStyle = '#00000022';
          ctx.fillRect(px, py, tile * 0.08, tile);
        }
        if (floorAt(x + 1, y)) {
          ctx.fillStyle = '#00000033';
          ctx.fillRect(px + tile * 0.92, py, tile * 0.08, tile);
        }
      })
    );

    this.wallLayer = layer;
    this.wallLayerFor = game.walls;
    this.wallLayerSize = tile * scale;
    return layer;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
