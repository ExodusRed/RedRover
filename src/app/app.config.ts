import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (/redrover/#/play) so the game works from any sub-folder on a static host.
    provideRouter(routes, withHashLocation()),
  ],
};
