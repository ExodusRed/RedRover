import { Routes } from '@angular/router';
import { GameMenu } from './game-menu/game-menu';
import { GameScreen } from './game-screen/game-screen';

export const routes: Routes = [
  { path: '', component: GameMenu, title: 'RedRover' },
  { path: 'play', component: GameScreen, title: 'RedRover · Play' },
  { path: '**', redirectTo: '' },
];
