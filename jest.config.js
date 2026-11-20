const path = require('node:path');

// SDK 58 puede instalar core dentro de expo. Jest no replica la resolución de
// Metro: resolver desde Expo evita instalar directamente un módulo interno.
const coreDirectory = path.dirname(require.resolve('expo-modules-core/package.json', {
  paths: [path.dirname(require.resolve('expo/package.json'))],
}));

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^expo-modules-core$': coreDirectory,
    '^expo-modules-core/(.*)$': `${coreDirectory}/$1`,
  },
};
