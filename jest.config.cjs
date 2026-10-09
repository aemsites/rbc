module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: { '^.+\\.js$': '@swc/jest' },
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  modulePathIgnorePatterns: ['/.claude/'],
  moduleNameMapper: {
    'scripts/aem\\.js': '<rootDir>/__mocks__/scripts/aem.js',
    'scripts/ecommerce-analytics\\.js': '<rootDir>/__mocks__/scripts/ecommerce-analytics.js',
    'scripts/config\\.js': '<rootDir>/__mocks__/scripts/config.js',
    'utils/placeholders\\.js': '<rootDir>/__mocks__/utils/placeholders.js',
  },
};
