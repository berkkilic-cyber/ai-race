/**
 * Expo config: app.json plus a build stamp (short commit and time) in `extra.build`, read
 * by src/ui/diagnostics/build.ts and shown small on the start screen and in the help panel,
 * so a screenshot from a phone says which build it is running. Evaluated by the Expo CLI
 * when it serves the manifest (Expo Go) or exports (web). Falls back quietly without git.
 */
const { execSync } = require('node:child_process');

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

module.exports = ({ config }) => {
  // EAS Build uploads the project without its .git folder and passes the commit in instead.
  const fromEnv = (process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.GITHUB_SHA || '').slice(0, 7);
  const commit = git('rev-parse --short HEAD') || fromEnv || 'unknown';
  const dirty = git('status --porcelain --untracked-files=no') !== '';
  const time = new Date().toISOString();
  // Web has no manifest at run time: the same stamp goes in through EXPO_PUBLIC_ variables,
  // which the bundler inlines (set here, before bundling starts, unless already set).
  if (!process.env.EXPO_PUBLIC_BUILD_COMMIT) {
    process.env.EXPO_PUBLIC_BUILD_COMMIT = commit;
    process.env.EXPO_PUBLIC_BUILD_DIRTY = dirty ? '1' : '';
    process.env.EXPO_PUBLIC_BUILD_TIME = time;
  }
  return {
    ...config,
    extra: { ...(config.extra || {}), build: { commit, dirty, time } },
  };
};
