export default {
  testEnvironment: 'node',
  transform: {},
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html"],
  collectCoverageFrom: [
    "src/**/*.{js,jsx}",
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  }
};
