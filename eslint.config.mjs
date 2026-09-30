import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Must come last: turns off ESLint rules that conflict with Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;

// Ticket # https://quintessentialalgorithms.atlassian.net/browse/CECS491-34?atlOrigin=eyJpIjoiZWI1ZTQ2YzI0YzAxNGVhY2JlNmZlYWE0MTI2MjQxZjEiLCJwIjoiaiJ9
