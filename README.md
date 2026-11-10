# RedRover

A maze-chase game set on Mars. Steer a small rover through a procedurally generated base,
collect every energy cell, and dodge the patrol drones hunting you — each with its own
pathfinding strategy. Grab an EMP charge to knock the drones offline and turn the tables.

**Play:** https://exodus.red/redrover *(coming soon)*

## Tech

- Angular + TypeScript
- HTML canvas rendering with a fixed-timestep game loop
- Procedural maze generation
- Drone AI using grid pathfinding (BFS / A*)

## Development

```bash
npm install
npm start        # dev server at http://localhost:4200
npm run build    # production build in dist/
```
