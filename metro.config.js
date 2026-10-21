const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Node core modules referenced by cheerio's dependency tree (used by the Nuvio plugin runtime).
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: path.resolve(__dirname, 'shims/stream.js'),
  util: path.resolve(__dirname, 'shims/util.js'),
  events: path.resolve(__dirname, 'shims/events.js'),
};

module.exports = config;
