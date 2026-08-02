/**
 * Root ESLint config.
 *
 * The repo holds three quite different kinds of JavaScript, so the rules are
 * layered rather than uniform: browser React/TypeScript under `src/`, ESM Node
 * under `server/` and `scripts/`, and a handful of CommonJS build configs at the
 * root. `functions/` keeps its own .eslintrc.js (Google style, CommonJS) and is
 * ignored here so the two don't fight.
 *
 * Deliberately close to the floor: this exists to catch real mistakes — unused
 * bindings, broken hook dependencies, accidental globals — not to impose a style
 * the 100-odd existing files were never written against.
 */
module.exports = {
  root: true,
  env: { es2022: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  rules: {
    // Prefixing an intentionally-unused binding with _ opts out. Applies to
    // caught errors too, which the codebase often ignores on purpose.
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
    ],
    // A `let` captured by a closure defined above its assignment genuinely
    // cannot become `const` — see waitForOnline in utils/networkUtils.ts.
    'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
  },
  overrides: [
    // --- browser React + TypeScript -----------------------------------------
    {
      files: ['src/**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: { ecmaFeatures: { jsx: true } },
      env: { browser: true },
      plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh', 'jsx-a11y'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
      ],
      rules: {
        // TypeScript's own checker owns undefined identifiers and unused
        // bindings; the base rules misread type-only syntax.
        'no-undef': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
        ],
        // `any` is still widespread in the older services; flag it as a nudge
        // rather than a blocker, so new code gets pushed toward real types
        // without the existing files failing the build.
        '@typescript-eslint/no-explicit-any': 'warn',
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

        // jsx-a11y is on at error level so new markup can't regress, but the
        // five rules the existing components already violate are warnings:
        // silencing them would hide the debt, and fixing them means adding
        // keyboard handlers and roles across a dozen components — a UX change
        // that deserves its own review, not a lint-config commit.
        'jsx-a11y/click-events-have-key-events': 'warn',
        'jsx-a11y/no-static-element-interactions': 'warn',
        'jsx-a11y/no-noninteractive-element-interactions': 'warn',
        'jsx-a11y/no-autofocus': 'warn',
        'jsx-a11y/media-has-caption': 'warn',
      },
    },

    // --- ESM Node: the container backend and the ops scripts ----------------
    {
      files: ['server/**/*.js', 'scripts/**/*.js'],
      env: { node: true },
    },

    // --- CommonJS: build and tooling config at the root ---------------------
    {
      files: ['*.cjs', '.eslintrc.cjs', 'postcss.config.js', 'tailwind.config.js', 'deploy.config.js'],
      env: { node: true },
      parserOptions: { sourceType: 'script' },
    },

    // --- Vite configs: TypeScript, Node-side -------------------------------
    {
      files: ['vite.config.ts', 'vite.config.production.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      env: { node: true },
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
