import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    resolvePluginsRelativeTo: __dirname,
    recommendedConfig: js.configs.recommended,
});

export default [
    {
        // Ignore patterns (previously in .eslintignore)
        ignores: [
            'eslint.config.mjs',
            'node_modules/',
            'dist/',
            'coverage/',
            'build/',
            '.env',
            '.env.*',
            'logs/',
            '*.log',
            'mysql_data_persistent/',
            'redis_data/',
        ],
    },
    ...compat.extends('airbnb-base', 'plugin:security/recommended-legacy'),
    {
        files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                // Defining common Node.js globals manually as 'env' is deprecated in Flat Config
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            // Custom rule overrides from your .eslintrc.js
            'no-console': 'off',
            'security/detect-object-injection': 'off',
            camelcase: 'off',
            'no-underscore-dangle': 'off',
            'class-methods-use-this': 'off',
            'consistent-return': 'off',
            'import/no-extraneous-dependencies': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
];
