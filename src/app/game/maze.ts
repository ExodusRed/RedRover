// Procedural maze generation and grid helpers.
// A maze is a 2D array where `true` means wall and `false` means floor.

export interface Point {
  x: number;
  y: number;
}

export type Walls = boolean[][];

export const DIRS: readonly Point[] = [
  { x: 0, y: -1 }, // up
  { x: 1, y: 0 }, // right
  { x: 0, y: 1 }, // down
  { x: -1, y: 0 }, // left
];

export type Rng = () => number;

/** Small seeded random generator (mulberry32), so a level can be reproduced from its seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isFloor(walls: Walls, x: number, y: number): boolean {
  return y >= 0 && y < walls.length && x >= 0 && x < walls[0].length && !walls[y][x];
}

/** Open (floor) neighbours of a tile. */
export function openNeighbours(walls: Walls, p: Point): Point[] {
  return DIRS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter((n) => isFloor(walls, n.x, n.y));
}

/**
 * Generates a "braided" maze: a perfect maze carved with a recursive backtracker,
 * then every dead end is opened up and a few extra loops are added.
 * Braided mazes have no dead ends, so the player can always escape a chaser.
 *
 * `cols` and `rows` must be odd.
 */
export function generateMaze(cols: number, rows: number, rng: Rng = Math.random, loopChance = 0.1): Walls {
  if (cols % 2 === 0 || rows % 2 === 0) throw new Error('Maze size must be odd');

  const walls: Walls = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
  const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length)];

  // 1. Recursive backtracker on the odd-coordinate cells.
  const stack: Point[] = [{ x: 1, y: 1 }];
  walls[1][1] = false;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const nx = cur.x + d.x * 2;
      const ny = cur.y + d.y * 2;
      return nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && walls[ny][nx];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = pick(options);
    walls[cur.y + d.y][cur.x + d.x] = false;
    walls[cur.y + d.y * 2][cur.x + d.x * 2] = false;
    stack.push({ x: cur.x + d.x * 2, y: cur.y + d.y * 2 });
  }

  // 2. Remove dead ends by knocking through one wall towards another corridor.
  for (let y = 1; y < rows - 1; y += 2) {
    for (let x = 1; x < cols - 1; x += 2) {
      if (openNeighbours(walls, { x, y }).length !== 1) continue;
      const options = DIRS.filter((d) => {
        const wx = x + d.x;
        const wy = y + d.y;
        return wx > 0 && wy > 0 && wx < cols - 1 && wy < rows - 1 && walls[wy][wx] && isFloor(walls, x + d.x * 2, y + d.y * 2);
      });
      if (options.length) {
        const d = pick(options);
        walls[y + d.y][x + d.x] = false;
      }
    }
  }

  // 3. A few extra random loops for more interesting chases.
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!walls[y][x] || (x % 2 === 0 && y % 2 === 0)) continue; // keep the pillars
      const horizontal = !walls[y][x - 1] && !walls[y][x + 1];
      const vertical = !walls[y - 1][x] && !walls[y + 1][x];
      if ((horizontal || vertical) && rng() < loopChance) walls[y][x] = false;
    }
  }

  return walls;
}

/** Breadth-first search distances from `start` to every tile (-1 = unreachable or wall). */
export function distanceMap(walls: Walls, start: Point): number[][] {
  const dist = walls.map((row) => row.map(() => -1));
  if (!isFloor(walls, start.x, start.y)) return dist;
  dist[start.y][start.x] = 0;
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const n of openNeighbours(walls, p)) {
      if (dist[n.y][n.x] === -1) {
        dist[n.y][n.x] = dist[p.y][p.x] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

/** All floor tiles. */
export function floorTiles(walls: Walls): Point[] {
  const tiles: Point[] = [];
  walls.forEach((row, y) => row.forEach((w, x) => !w && tiles.push({ x, y })));
  return tiles;
}
