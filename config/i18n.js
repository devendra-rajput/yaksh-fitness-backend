/**
 * Internationalization (i18n) Configuration
 * Sets up localization support
 */

const i18n = require('i18n');
const path = require('path');

// i18n configuration
i18n.configure({
  locales: ['en', 'es'], // 1. Supported languages
  directory: path.join(__dirname, '../locales'), // 2. Path to translation files
  defaultLocale: 'en', // 3. Default language if none is specified
  // queryParameter: 'lang', // 4. Enables language override via URL query (?lang=fr)
  autoReload: true, // 5. Watches locale files for changes and reloads them
  updateFiles: false, // 6. Prevents creating/updating locale files with missing keys
  syncFiles: false, // 7. Prevents copying missing keys to all locale files
  header: 'accept-language',
  objectNotation: true,
});

module.exports = i18n;
