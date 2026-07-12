// Shared base path helper for referencing files in /public (e.g. images, icons)
// from anywhere in the app — mirrors the computation in App.tsx so pages don't
// each redefine it.
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
