import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'game-menu',
  imports: [RouterLink],
  templateUrl: './game-menu.html',
  styleUrl: './game-menu.css',
})
export class GameMenu {
  readonly highScore = readHighScore();
}

function readHighScore(): number {
  try {
    return Number(localStorage.getItem('redrover.highscore')) || 0;
  } catch {
    return 0;
  }
}
