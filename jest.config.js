module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@site/(.*)$': '<rootDir>/$1',
  },
};
