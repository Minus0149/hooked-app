const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    compress: {
      ...config.transformer?.minifierConfig?.compress,
      drop_console: true,
      drop_debugger: true,
    },
    mangle: true,
    keep_fnames: false,
  },
};

module.exports = config;
