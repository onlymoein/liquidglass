// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const library = path.resolve(__dirname, '..');

// Let Metro read the library in the parent folder, and resolve its name to it.
// `experiments.autolinkingModuleResolution` in app.json resolves react-native, expo and the
// other packages the library also installs in ../node_modules to this app's copies.
config.watchFolders = [library];
config.resolver.extraNodeModules = { '@onlymoein/liquidglass-native': library };

module.exports = config;
