import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, ValueProvider } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AppModule } from './app.module';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export var chatBaseUrlProvider: ValueProvider = <ValueProvider> {
  provide: 'CHAT_BASE_URL',
  useValue: 'http://localhost:5111'
}

export var accountsBaseUrlProvider: ValueProvider = <ValueProvider> {
  provide: 'ACCOUNTS_BASE_URL',
  useValue: 'http://localhost:5049'
}

export const signalUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'SIGNALR_URL',
  useValue: 'http://localhost:5111/conversation'
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    chatBaseUrlProvider,
    accountsBaseUrlProvider,
    signalUrlProvider,
    importProvidersFrom(AppModule), provideAnimationsAsync()
  ]
};
