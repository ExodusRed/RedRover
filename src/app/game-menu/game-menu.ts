import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScoreEntry, fetchTopScores } from '../game/leaderboard';
import { ScoreTable } from '../score-table/score-table';

@Component({
  selector: 'game-menu',
  imports: [RouterLink, ScoreTable],
  templateUrl: './game-menu.html',
  styleUrl: './game-menu.css',
})
export class GameMenu implements OnInit {
  readonly highScore = readHighScore();
  readonly topScores = signal<ScoreEntry[] | null>(null);
  readonly leaderboardError = signal(false);

  ngOnInit(): void {
    fetchTopScores()
      .then((top) => this.topScores.set(top))
      .catch(() => this.leaderboardError.set(true));
  }
}

function readHighScore(): number {
  try {
    return Number(localStorage.getItem('redrover.highscore')) || 0;
  } catch {
    return 0;
  }
}
