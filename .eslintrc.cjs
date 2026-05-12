module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parserOptions: {
    project: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/no-redundant-type-constituents': 'warn',
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/restrict-template-expressions': 'warn',
        '@typescript-eslint/no-misused-promises': 'warn',
        '@typescript-eslint/consistent-type-imports': 'warn',
        'no-self-assign': 'warn',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.next/', '*.js', '*.mjs'],
}
