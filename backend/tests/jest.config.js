module.exports = {
  testEnvironment: 'node',
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '../agents/**/*.js',
    '../api/**/*.js',
    '../db/**/*.js',
    '../middleware/**/*.js',
    '../utils/**/*.js',
    '!../node_modules/**',
    '!../tests/**'
  ],
  testMatch: [
    '**/*.test.js'
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  testTimeout: 60000,
  maxWorkers: '50%',
  verbose: true,
  bail: false,
  collectCoverage: false,
  preset: 'default',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../$1'
  },
  transformIgnorePatterns: [],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs'
        }]
      ]
    }]
  }
};