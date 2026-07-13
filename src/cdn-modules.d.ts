// TTS libraries are loaded at runtime from CDN URLs (see models.ts) rather
// than installed as npm packages, so no type declarations exist for them —
// these dynamic imports are genuinely `any` at the type level.
declare module "https://cdn.jsdelivr.net/*";
