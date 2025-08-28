"use strict";

/**
 * Font and Text Encoding Utilities
 * Provides robust handling for international characters in emails and documents
 * Specifically designed to handle Spanish and Romanian scale names
 */

/**
 * Utility function to properly encode text with international characters
 * Ensures proper handling of Spanish and Romanian characters
 * @param {string} text - Text to encode
 * @returns {string} - Properly encoded text for HTML
 */
const encodeInternationalText = (text) => {
  if (!text) return text;
  
  // Ensure the text is properly encoded for HTML
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Get web-safe font stack that supports international characters
 * Prioritizes fonts that handle Spanish and Romanian characters well
 * @returns {string} - CSS font-family string
 */
const getInternationalFontStack = () => {
  return `
    "Segoe UI", 
    "DejaVu Sans", 
    "Lucida Grande", 
    "Helvetica Neue", 
    Arial, 
    "Liberation Sans", 
    "Noto Sans", 
    sans-serif
  `.replace(/\s+/g, ' ').trim();
};

/**
 * Get font stack specifically optimized for email clients
 * Uses fonts that are widely supported across email clients
 * @returns {string} - CSS font-family string for emails
 */
const getEmailFontStack = () => {
  return `
    "Segoe UI", 
    "Helvetica Neue", 
    Arial, 
    "Liberation Sans", 
    sans-serif
  `.replace(/\s+/g, ' ').trim();
};

/**
 * Sanitize text for safe HTML insertion
 * More comprehensive than basic encoding
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeHtmlText = (text) => {
  if (!text) return text;
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '');
};

/**
 * Check if text contains international characters
 * Useful for determining if special font handling is needed
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains international characters
 */
const hasInternationalCharacters = (text) => {
  if (!text) return false;
  
  // Check for common Spanish and Romanian characters
  const internationalChars = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž]/;
  
  return internationalChars.test(text);
};

/**
 * Generate CSS styles for international text display
 * @param {string} fontSize - Font size (e.g., '16px', '1.2em')
 * @param {string} fontWeight - Font weight (e.g., 'normal', 'bold')
 * @returns {string} - CSS styles string
 */
const getInternationalTextStyles = (fontSize = '14px', fontWeight = 'normal') => {
  return `
    font-family: ${getInternationalFontStack()};
    font-size: ${fontSize};
    font-weight: ${fontWeight};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  `.replace(/\s+/g, ' ').trim();
};

/**
 * Process scale name for email display
 * Combines encoding and font handling for scale names
 * @param {string} scaleName - Raw scale name from database
 * @returns {object} - Processed scale name data
 */
const processScaleNameForEmail = (scaleName) => {
  if (!scaleName) {
    return {
      encoded: null,
      hasInternational: false,
      styles: getInternationalTextStyles()
    };
  }
  
  const encoded = encodeInternationalText(scaleName);
  const hasInternational = hasInternationalCharacters(scaleName);
  
  return {
    encoded,
    hasInternational,
    styles: getInternationalTextStyles('16px', 'bold'),
    fontStack: getEmailFontStack()
  };
};

module.exports = {
  encodeInternationalText,
  getInternationalFontStack,
  getEmailFontStack,
  sanitizeHtmlText,
  hasInternationalCharacters,
  getInternationalTextStyles,
  processScaleNameForEmail
};
