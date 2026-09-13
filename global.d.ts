/**
 * Minimal ambient declaration for `process.env` access in app code
 * (config/env.ts). Deliberately not pulling in the full `@types/node`
 * package here — its ambient globals (`process`, `Buffer`, `setTimeout`
 * returning `NodeJS.Timeout`, etc.) can collide with React Native's own
 * runtime type shims. This declares only the shape actually used.
 */
declare const process: {
  env: Record<string, string | undefined>;
};
