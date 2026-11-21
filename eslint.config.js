// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const { builtinModules } = require('node:module');
const expoConfig = require('eslint-config-expo/flat');

const nodeBuiltins = builtinModules.filter((m) => !m.startsWith('_'));

const reactAndExpo = [
  { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: 'No React here.' },
  { group: ['react-native', 'react-native/*', 'react-native-*', '@react-native/*'], message: 'No React Native here.' },
  { group: ['expo', 'expo/*', 'expo-*', '@expo/*'], message: 'No Expo here.' },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
  {
    // No import cycles anywhere in src: they warn on native ("Require cycle") and can leave
    // a module half-initialised when it is first used.
    files: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
    },
  },
  {
    // The engine is pure, deterministic TypeScript and imports nothing outside src/engine.
    files: ['src/engine/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins.map((name) => ({ name, message: 'No Node APIs in the engine.' })),
          patterns: [
            ...reactAndExpo,
            { group: ['zustand', 'zustand/*'], message: 'No state libraries in the engine.' },
            { group: ['node:*'], message: 'No Node APIs in the engine.' },
            {
              group: ['@/*', '!@/engine', '!@/engine/*'],
              message: 'The engine imports nothing outside src/engine.',
            },
            {
              group: ['../content', '../content/*', '../ui', '../ui/*', '../../content', '../../content/*', '../../ui', '../../ui/*'],
              message: 'The engine imports nothing outside src/engine.',
            },
          ],
        },
      ],
      // Catches any other relative import that escapes src/engine.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/engine',
              from: './',
              except: ['./src/engine', './node_modules'],
              message: 'The engine imports nothing outside src/engine.',
            },
          ],
        },
      ],
    },
  },
  {
    // The idle economy (Garage) is pure like the engine: imports nothing outside src/idle.
    files: ['src/idle/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins.map((name) => ({ name, message: 'No Node APIs in the idle engine.' })),
          patterns: [
            ...reactAndExpo,
            { group: ['zustand', 'zustand/*'], message: 'No state libraries in the idle engine.' },
            { group: ['node:*'], message: 'No Node APIs in the idle engine.' },
            { group: ['@/*', '!@/idle', '!@/idle/*'], message: 'The idle engine imports nothing outside src/idle.' },
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [{ target: './src/idle', from: './', except: ['./src/idle', './node_modules'], message: 'The idle engine imports nothing outside src/idle.' }],
        },
      ],
    },
  },
  {
    // Content packs: data, strings and validation only. May use engine types.
    files: ['src/content/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...reactAndExpo,
            { group: ['@/ui', '@/ui/*', '../ui', '../ui/*', '../../ui', '../../ui/*'], message: 'Content must not import UI.' },
          ],
        },
      ],
    },
  },
]);
