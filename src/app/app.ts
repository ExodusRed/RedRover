import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// import { GameMenu } from './game-menu/game-menu';

import { Home } from './home/home';

// import { GameScreen } from './game-screen/game-screen';

@Component({
  selector: 'root',
  imports: [RouterOutlet, Home],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('red-rover');
}
