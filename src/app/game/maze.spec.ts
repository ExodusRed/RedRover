import { distanceMap, floorTiles, generateMaze, openNeighbours, seededRng } from './maze';

describe('generateMaze', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => i + 1);

  it('has a solid outer border', () => {
    for (const seed of seeds) {
      const walls = generateMaze(21, 15, seededRng(seed));
      walls.forEach((row, y) =>
        row.forEach((wall, x) => {
          if (x === 0 || y === 0 || x === 20 || y === 14) expect(wall).toBe(true);
        })
      );
    }
  });

  it('connects every floor tile', () => {
    for (const seed of seeds) {
      const walls = generateMaze(21, 15, seededRng(seed));
      const dist = distanceMap(walls, { x: 1, y: 1 });
      for (const t of floorTiles(walls)) expect(dist[t.y][t.x]).toBeGreaterThanOrEqual(0);
    }
  });

  it('has no dead ends, so the rover can always escape', () => {
    for (const seed of seeds) {
      const walls = generateMaze(21, 15, seededRng(seed));
      for (const t of floorTiles(walls)) expect(openNeighbours(walls, t).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('is reproducible from a seed', () => {
    expect(generateMaze(21, 15, seededRng(42))).toEqual(generateMaze(21, 15, seededRng(42)));
  });

  it('rejects even sizes', () => {
    expect(() => generateMaze(20, 15)).toThrow();
  });
});
