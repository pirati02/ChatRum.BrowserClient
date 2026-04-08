import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
  ValueProvider,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withJsonpSupport,
} from '@angular/common/http';

import { routes } from './app.routes';
import { AppModule } from './app.module';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { environment } from '../environments/environment';
import { authInterceptor } from './core/auth/auth.interceptor';
import { GATEWAY_URL } from './core/auth/gateway.token';

const base = environment.gatewayUrl.replace(/\/$/, '');

export const chatBaseUrlProvider: ValueProvider = {
  provide: 'CHAT_BASE_URL',
  useValue: `${base}/chat`,
};

export const accountsBaseUrlProvider: ValueProvider = {
  provide: 'ACCOUNTS_BASE_URL',
  useValue: `${base}/account`,
};

export const friendshipBaseUrlProvider: ValueProvider = {
  provide: 'FRIENDSHIP_BASE_URL',
  useValue: `${base}/friendship`,
};

export const feedBaseUrlProvider: ValueProvider = {
  provide: 'FEED_BASE_URL',
  useValue: `${base}/feed`,
};

export const notificationsBaseUrlProvider: ValueProvider = {
  provide: 'NOTIFICATIONS_BASE_URL',
  useValue: `${base}/notifications`,
};

export const chatSignalUrlProvider: ValueProvider = {
  provide: 'CHAT_SIGNALR_URL',
  useValue: `${base}/hub/chat`,
};

export const friendshipSignalUrlProvider: ValueProvider = {
  provide: 'FRIENDSHIP_SIGNALR_URL',
  useValue: `${base}/hub/friendship`,
};

export const notificationsSignalUrlProvider: ValueProvider = {
  provide: 'NOTIFICATIONS_SIGNALR_URL',
  useValue: `${base}/hub/notifications`,
};

const gatewayUrlProvider: ValueProvider = {
  provide: GATEWAY_URL,
  useValue: base,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withJsonpSupport(),
      withInterceptors([authInterceptor]),
    ),
    gatewayUrlProvider,
    chatBaseUrlProvider,
    accountsBaseUrlProvider,
    chatSignalUrlProvider,
    friendshipSignalUrlProvider,
    notificationsSignalUrlProvider,
    friendshipBaseUrlProvider,
    feedBaseUrlProvider,
    notificationsBaseUrlProvider,
    importProvidersFrom(AppModule),
    provideAnimationsAsync(),
  ],
};
