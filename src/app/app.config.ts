import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, ValueProvider} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {AppModule} from './app.module';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';

const ocelotBaseUrl = 'http://localhost:5136';

export var chatBaseUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'CHAT_BASE_URL',
  useValue: `${ocelotBaseUrl}/chat`
}

export var accountsBaseUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'ACCOUNTS_BASE_URL',
  useValue: `${ocelotBaseUrl}/account`
}

export var friendshipBaseUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'FRIENDSHIP_BASE_URL',
  useValue: `${ocelotBaseUrl}/friendship`
}

export var feedBaseUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'FEED_BASE_URL',
  useValue: `${ocelotBaseUrl}/feed`
}

export const signalUrlProvider: ValueProvider = <ValueProvider>{
  provide: 'SIGNALR_URL',
  useValue: `${ocelotBaseUrl}/hub/chat`
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    chatBaseUrlProvider,
    accountsBaseUrlProvider,
    signalUrlProvider,
    friendshipBaseUrlProvider,
    feedBaseUrlProvider,
    importProvidersFrom(AppModule), provideAnimationsAsync()
  ]
};
