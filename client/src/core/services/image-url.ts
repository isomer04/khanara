/**
 * Resolves a raw image path (relative or absolute) to a full URL.
 *
 * NOTE: Use this only for plain <img [src]> bindings (e.g. the image-upload
 * preview). For [ngSrc] bindings use ngSrcFor() instead.
 */
export function resolveImageUrl(
  path: string | null | undefined,
  placeholder: '/kitchen-placeholder.png' | '/dish-placeholder.png' | '/user.png',
  apiUrl: string,
): string {
  if (!path) return placeholder;

  if (path.startsWith('/')) {
    try {
      const base = new URL(apiUrl, window.location.origin);
      return `${base.protocol}//${base.host}${path}`;
    } catch {
      return path;
    }
  }

  return path;
}

/**
 * Returns a value safe to use as [ngSrc] with NgOptimizedImage.
 *
 * NgOptimizedImage requires a full absolute URL — it rejects root-relative
 * paths at runtime. This function resolves all paths to absolute URLs:
 *
 *   /images/kitchens/foo.jpg  → https://localhost:7071/images/kitchens/foo.jpg
 *   /kitchen-placeholder.png  → http://localhost:3000/kitchen-placeholder.png
 *   https://res.cloudinary.com/... → unchanged
 *   photo.jpg (bare, test-only) → unchanged (already safe for NgOptimizedImage
 *                                  when IMAGE_LOADER returns it as-is)
 *
 * When you switch to Cloudinary for all images, update ngSrc values to use
 * Cloudinary public IDs and replace IMAGE_LOADER with provideCloudinaryLoader().
 */
export function ngSrcFor(
  path: string | null | undefined,
  placeholder: '/kitchen-placeholder.png' | '/dish-placeholder.png' | '/user.png',
  apiUrl: string,
): string {
  const raw = path || placeholder;

  // Already a full URL (Cloudinary, S3, etc.) — pass through
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  // /images/... are served by the .NET API static file middleware
  if (raw.startsWith('/images/')) {
    try {
      const base = new URL(apiUrl, window.location.origin);
      return `${base.protocol}//${base.host}${raw}`;
    } catch {
      return raw;
    }
  }

  // Root-relative asset (placeholder, favicon, etc.) — served by the Angular app
  if (raw.startsWith('/')) {
    return `${window.location.origin}${raw}`;
  }

  // Bare relative path (e.g. 'photo.jpg') — only appears in test data.
  // In production all paths are /images/* or absolute Cloudinary URLs.
  // Return as-is; the IMAGE_LOADER pass-through in tests handles it safely.
  return raw;
}
