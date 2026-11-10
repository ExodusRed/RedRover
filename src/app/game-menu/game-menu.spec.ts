import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GameMenu } from './game-menu';

describe('GameMenu', () => {
  let component: GameMenu;
  let fixture: ComponentFixture<GameMenu>;

  beforeEach(async () => {
    // No real server in unit tests: pretend the leaderboard is empty.
    globalThis.fetch = (async () => new Response(JSON.stringify({ top: [] }))) as typeof fetch;
    await TestBed.configureTestingModule({
      imports: [GameMenu],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GameMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
