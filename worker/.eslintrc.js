module.exports = {
  env: {
    browser: false,
    worker: true,
    es2022: true,
  },
  globals: {
    HTMLRewriter: 'readonly',
    Response: 'readonly',
    Headers: 'readonly',
    fetch: 'readonly',
    URL: 'readonly',
    AbortSignal: 'readonly',
  },
  rules: {
    // _ga is Google's cookie name, not ours
    'no-underscore-dangle': ['error', { allow: ['_ga'] }],
  },
};
