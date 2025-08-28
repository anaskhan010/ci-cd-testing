// services/translation.service.js
const axios = require("axios");

const DETECT_URL = "http://libretranslate-zgkgoks8s004wkok80gk8c08.37.27.187.4.sslip.io/detect";
const TRANSLATE_URL = "http://libretranslate-zgkgoks8s004wkok80gk8c08.37.27.187.4.sslip.io/translate";

/**
 * Detect the language of the given text.
 * @param {string} text - The text to detect language for.
 * @returns {Promise<string>} - The detected language code (e.g., 'en', 'ro').
 */
async function detectLanguage(text) {
  try {
    const { data } = await axios.post(DETECT_URL, { q: text });
    if (Array.isArray(data) && data.length > 0 && data[0].language) {
      return {
        language: data[0].language,
        confidence: data[0].confidence || 100.000,
      };
    }
    throw new Error("Language detection failed: Invalid response format");
  } catch (error) {
    console.error("Error detecting language:", error.message);
    throw error;
  }
}

/**
 * Translate text to a target language.
 * @param {string} text - The text to translate.
 * @param {string} sourceLang - Source language code (e.g., 'ro').
 * @param {string} targetLang - Target language code (default: 'en').
 * @returns {Promise<string>} - Translated text.
 */
async function translateText(text, sourceLang, targetLang = "en") {
  try {
    const { data } = await axios.post(TRANSLATE_URL, {
      q: text,
      source: sourceLang,
      target: targetLang
    });
    if (data && data.translatedText) {
      return data.translatedText;
    }
    throw new Error("Translation failed: Invalid response format");
  } catch (error) {
    console.error("Error translating text:", error.message);
    throw error;
  }
}

/**
 * Ensure text is in English. Detects language and translates if needed.
 * @param {string} text
 * @returns {Promise<{original: string, translated: string, detectedLang: string}>}
 */
async function ensureEnglish(text) {
  const detectedLang = (await detectLanguage(text)).language;

  if (detectedLang.toLowerCase() !== "en") {
    const translated = await translateText(text, detectedLang, "en");
    return { original: text, translated, detectedLang };
  }

  // Already English, no translation needed
  return { original: text, translated: text, detectedLang };
}

module.exports = {
  detectLanguage,
  translateText,
  ensureEnglish
};
