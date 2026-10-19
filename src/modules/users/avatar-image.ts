import sharpModule = require('sharp');

// Sharp 0.35 publishes separate CJS/ESM declarations. The repository's legacy
// TS module resolution sees the ESM declaration while Node loads the callable
// CJS export. Keep this vendor interop at the image boundary.
export const avatarImage =
  sharpModule as unknown as typeof import('sharp').default;
