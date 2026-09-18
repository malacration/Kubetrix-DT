module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/growth-*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { baseUrl: './ui', target: 'ES2022', module: 'CommonJS', esModuleInterop: true, skipLibCheck: true, strictNullChecks: true, jsx: 'react' } }] },
  moduleNameMapper: { '^app/(.*)$': '<rootDir>/ui/app/$1' },
};
