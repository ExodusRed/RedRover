// Talks to the leaderboard API on exodus.red (Cloudflare Worker + D1 database).

export interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  date: string;
}

const API = '/api/redrover/scores';
const NAME_KEY = 'redrover.name';

export async function fetchTopScores(): Promise<ScoreEntry[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`Leaderboard unavailable (${res.status})`);
  return (await res.json()).top;
}

export async function submitScore(name: string, score: number, level: number): Promise<{ rank: number; top: ScoreEntry[] }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, level }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Could not submit score (${res.status})`);
  return data;
}

/** Remember the player's name between games. */
export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
