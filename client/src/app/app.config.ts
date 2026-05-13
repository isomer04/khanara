import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';
import { InitService } from '../core/services/init-service';
import { lastValueFrom } from 'rxjs';
import { errorInterceptor } from '../core/interceptors/error-interceptor';
import { jwtInterceptor } from '../core/interceptors/jwt-interceptor';
import { loadingInterceptor } from '../core/interceptors/loading-interceptor';
import { environment } from '../environments/environment';

/**
 * Custom image loader — currently a pass-through that resolves relative paths
 * against the API origin.  When you add Cloudinary, replace this body with
 * provideCloudinaryLoader('https://res.cloudinary.com/<cloud>') in providers
 * and update ngSrc values to use Cloudinary public IDs.
 */
function khanaraImageLoader(config: ImageLoaderConfig): string {
  const src = config.src;

  // Already a full URL (Cloudinary, external CDN, user-uploaded photo, etc.)
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // Only rewrite root-relative paths that are API-hosted (served by the .NET
  // static file middleware).  Other root-relative assets like /user.png are
  // served by the Angular dev server / CDN and must be returned unchanged.
  if (src.startsWith('/images/')) {
    const base = environment.apiUrl.replace(/\/$/, ''); // strip trailing slash
    // Include width as a query param so ngSrcset can request correctly-sized
    // images once a CDN/resizing layer is in place (required by the docs for
    // custom loaders to support ngSrcset).
    const widthParam = config.width ? `?w=${config.width}` : '';
    return `${base}${src}${widthParam}`;
  }

  // All other paths (local assets, etc.) — return as-is.
  return src;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withViewTransitions(),
    ),
    // Use the Fetch API backend — smaller, faster, supports streaming
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, jwtInterceptor, loadingInterceptor]),
    ),
    // NgOptimizedImage loader — swap for provideCloudinaryLoader() later
    {
      provide: IMAGE_LOADER,
      useValue: khanaraImageLoader,
    },
    provideAppInitializer(async () => {
      const initService = inject(InitService);

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            await lastValueFrom(initService.init());
          } finally {
            const splash = document.getElementById('initial-splash');
            if (splash) {
              splash.remove();
            }
            resolve();
          }
        }, 500);
      });
    }),
  ],
};
