const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    compress: {
      ...config.transformer?.minifierConfig?.compress,
      // strip chatter but keep warn/error — they carry the diagnostics
      // (dead audio, crash reports) worth having in release builds
      pure_funcs: ["console.log", "console.info", "console.debug"],
      drop_debugger: true,
    },
    mangle: true,
    keep_fnames: false,
  },
};

module.exports = config;
