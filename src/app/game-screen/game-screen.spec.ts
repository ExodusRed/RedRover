import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GameScreen } from './game-screen';

describe('GameScreen', () => {
  let component: GameScreen;
  let fixture: ComponentFixture<GameScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameScreen],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GameScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
