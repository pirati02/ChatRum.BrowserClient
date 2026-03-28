import { InjectionToken } from '@angular/core';

/** Gateway origin (no trailing slash), used by auth interceptor URL checks */
export const GATEWAY_URL = new InjectionToken<string>('GATEWAY_URL');
