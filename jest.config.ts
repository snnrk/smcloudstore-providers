import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  cache: false,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/packages/**/src/**/*.{j,t}s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {
    '^.+\\.(j|t)s$': '@swc/jest',
  },
  verbose: true,
};

export default config;
