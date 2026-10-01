export default {
  testEnvironment: 'node',
  transform: {},
  testTimeout: 60000,
  verbose: true,
  testMatch: ['<rootDir>/tests/jest/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup/jest.setup.js'],
};
