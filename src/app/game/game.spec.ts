import { Game, position } from './game';

describe('Game', () => {
  it('starts in the ready state with energy cells and EMPs placed', () => {
    const game = new Game();
    expect(game.state).toBe('ready');
    expect(game.cells.size).toBeGreaterThan(50);
    expect(game.emps.size).toBe(4);
  });

  it('starts playing when the player steers, and the rover moves', () => {
    const game = new Game();
    const start = position(game.rover);
    game.steer({ x: 0, y: -1 });
    game.steer({ x: 1, y: 0 });
    expect(game.state).toBe('playing');
    for (let i = 0; i < 20; i++) game.update(0.016);
    const now = position(game.rover);
    expect(now.x !== start.x || now.y !== start.y).toBe(true);
  });

  it('collects energy cells for points', () => {
    const game = new Game();
    game.steer({ x: 1, y: 0 });
    game.steer({ x: 0, y: -1 });
    const before = game.cells.size;
    for (let i = 0; i < 120; i++) game.update(0.016);
    expect(game.cells.size).toBeLessThan(before);
    expect(game.score).toBeGreaterThan(0);
  });

  it('reports events for sound effects', () => {
    const game = new Game();
    game.steer({ x: 1, y: 0 });
    game.steer({ x: 0, y: -1 });
    for (let i = 0; i < 120; i++) game.update(0.016);
    const types = game.drainEvents().map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('cell');
    expect(game.drainEvents()).toEqual([]); // drained
  });

  it('pauses and resumes', () => {
    const game = new Game();
    game.steer({ x: 1, y: 0 });
    game.togglePause();
    expect(game.state).toBe('paused');
    game.togglePause();
    expect(game.state).toBe('playing');
  });
});
