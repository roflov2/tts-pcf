/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/ScamwatchChat"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/ScamwatchChat/__tests__/setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          module: "commonjs",
          esModuleInterop: true,
          target: "es2019",
          skipLibCheck: true,
          types: ["jest", "node"],
        },
        diagnostics: { warnOnly: false },
      },
    ],
  },
  collectCoverageFrom: [
    "ScamwatchChat/**/*.{ts,tsx}",
    "!ScamwatchChat/generated/**",
    "!ScamwatchChat/__tests__/**",
    "!ScamwatchChat/components/icons.tsx",
  ],
  coverageReporters: ["text-summary", "lcov"],
};
