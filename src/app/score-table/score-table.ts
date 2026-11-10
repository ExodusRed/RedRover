import { Component, input } from '@angular/core';
import { ScoreEntry } from '../game/leaderboard';

/** Top-10 leaderboard table. Highlights one row (e.g. the score you just submitted). */
@Component({
  selector: 'score-table',
  templateUrl: './score-table.html',
  styleUrl: './score-table.css',
})
export class ScoreTable {
  readonly entries = input.required<ScoreEntry[]>();
  readonly highlight = input<number | null>(null); // 1-based rank to highlight
}
