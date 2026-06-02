const { withAppBuildGradle } = require('@expo/config-plugins');

// Renames the output APK to VoiceToDo-{versionName}.apk
module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('outputFileName')) {
      mod.modResults.contents += `
android.applicationVariants.all { variant ->
    variant.outputs.all {
        outputFileName = "VoiceToDo-\${variant.versionName}.apk"
    }
}
`;
    }
    return mod;
  });
