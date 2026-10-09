module.exports = {
  root: true,
  extends: 'airbnb-base',
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
  },
  overrides: [
    {
      files: ['**/*.test.js', '__mocks__/**/*.js'],
      env: { jest: true },
      rules: {
        'class-methods-use-this': 'off',
        'max-classes-per-file': 'off',
        'no-useless-constructor': 'off',
        'no-empty-function': 'off',
      },
    },
  ],
};
