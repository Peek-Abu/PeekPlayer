import globals from 'globals';

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        videojs: 'readonly',
        express: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
      'eqeqeq': ['warn', 'smart'],
      'prefer-const': 'warn'
    }
  },
  {
    // Node-side helper that references the host app's express instance
    files: ['src/server/**/*.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
