/**
 * Security Sanitization Utilities for NearExpiry.
 */

/**
 * Escapes all regular expression metacharacters in a string to prevent
 * ReDoS (Regular Expression Denial of Service) and regex injection into MongoDB queries.
 *
 * @param {string} str - Raw user input string
 * @returns {string} - Escaped string safe for RegExp or MongoDB $regex
 */
export const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
