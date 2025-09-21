  import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, ValueProvider } from '@angular/core';
  import { provideRouter } from '@angular/router';

  import { routes } from './app.routes';
  import { AppModule } from './app.module';
  import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

  export var chatBaseUrlProvider: ValueProvider = <ValueProvider> {
    provide: 'CHAT_BASE_URL',
    useValue: 'http://localhost:5136/chat'
  }

  export var accountsBaseUrlProvider: ValueProvider = <ValueProvider> {
    provide: 'ACCOUNTS_BASE_URL',
    useValue: 'http://localhost:5136/account'
  }

  export var friendshipBaseUrlProvider: ValueProvider = <ValueProvider> {
    provide: 'FRIENDSHIP_BASE_URL',
    useValue: 'http://localhost:5136/friendship'
  }

  export const signalUrlProvider: ValueProvider = <ValueProvider>{
    provide: 'SIGNALR_URL',
    useValue: 'http://localhost:5136/hub/chat'
  }

  export const appConfig: ApplicationConfig = {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(routes),
      chatBaseUrlProvider,
      accountsBaseUrlProvider,
      signalUrlProvider,
      friendshipBaseUrlProvider,
      importProvidersFrom(AppModule), provideAnimationsAsync()
    ]
  };
