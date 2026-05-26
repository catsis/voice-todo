const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve package.json "exports" field,
// which lets @anthropic-ai/sdk use its browser-compatible build.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
