const cron = require("node-cron");
const { detectLanguage } = require("../services/translation.service");
const { delay } = require("../utils/delay.util");

const {
  getReportsWithNullLanguage,
  updateReportLanguage,
  getTicketActivitiesWithNullLanguage,
  updateTicketActivityLanguage,
  getEcrfAnswersWithNullLanguage,
  updateEcrfAnswerLanguage,
  getAesiResponsesWithNullLanguage,
  updateAesiResponseLanguage,
} = require("../models/incident_report/IncidentReportModel");

/**
 * Generic handler to fetch, detect, and update language for a table
 */
async function detectAndUpdate(records, textKey, updateFn, sourceName) {
  for (const rec of records) {
    try {
      let detectedLang = "en";
      let confidence = 100.000;

      if (rec[textKey] && rec[textKey].trim() !== "") {
        try {
          const detection = await detectLanguage(rec[textKey]);
          detectedLang = detection.language || "en";
          confidence = detection.confidence || 100.000;
        } catch (err) {
          console.error(`❌ [${sourceName}] Detection error for ID ${rec.id}:`, err.message);
          continue; // skip update for this record
        }
      }

      try {
        await updateFn(rec.id, detectedLang, confidence);
        console.log(`✅ [${sourceName}] Updated ID ${rec.id} → ${detectedLang} (${confidence})`);
      } catch (err) {
        console.error(`❌ [${sourceName}] Update error for ID ${rec.id}:`, err.message);
        continue;
      }

      // Avoid hitting API limits
      await delay(1000);

    } catch (outerErr) {
      console.error(`❌ [${sourceName}] Unexpected error for ID ${rec.id}:`, outerErr.message);
      continue; // never break loop
    }
  }
}

/**
 * Main cron execution function
 */
async function runLanguageDetectionJob() {
  console.log("🚀 Running daily language detection job...");

  try {
    // Incident reports
    const reports = await getReportsWithNullLanguage();
    await detectAndUpdate(reports, "description", updateReportLanguage, "IncidentReport");

    // Ticket activities
    const tickets = await getTicketActivitiesWithNullLanguage();
    await detectAndUpdate(tickets, "text", updateTicketActivityLanguage, "TicketActivity");

    // eCRF answers
    const answers = await getEcrfAnswersWithNullLanguage();
    await detectAndUpdate(answers, "text", updateEcrfAnswerLanguage, "EcrfAnswer");

    // AESI responses
    const responses = await getAesiResponsesWithNullLanguage();
    await detectAndUpdate(responses, "text", updateAesiResponseLanguage, "AesiResponse");

    console.log("✅ Language detection job finished.");
  } catch (err) {
    console.error("❌ Cron job top-level error:", err.message);
  }
}

/**
 * Cron scheduler
 */
function startLanguageDetectionCron() {
  // runs daily 
  cron.schedule("45 01 * * *", runLanguageDetectionJob);
  console.log("🕛 Language detection cron scheduled (daily at midnight).");
}

module.exports = { startLanguageDetectionCron, runLanguageDetectionJob };
