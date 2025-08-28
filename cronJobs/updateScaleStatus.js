const cron = require("node-cron");
const signModel = require("../models/sign_well_model/signWellModel");
const signwell = require("@api/signwell");
const {delay} = require("../utils/delay.util")

const startScaleStatusCron = () => {
  // Run every day at 12 AM
  cron.schedule("0 */3 * * *", async () => {
    console.log("[CRON] Starting scheduled scale status refresh...");

    try {
      const incompleteDocs = await signModel.getIncompleteDocuments();

      console.log(`[CRON] Found ${incompleteDocs.length} incomplete documents`);

      let successCount = 0;
      let failureCount = 0;
      
      for (const doc of incompleteDocs) {
        try {
          // 1 second delay between each request
          await delay(1000);

          // Fetch the latest document status from SignWell
          const { data } = await signwell.getApiV1DocumentsId({ id: doc.document_id });

          const recipient1 = data.recipients.find((r) => r.id === "1");
          const recipient2 = data.recipients.find((r) => r.id === "2");

          const updateData = {
            recipient1_status: recipient1?.status || null,
            recipient2_status: recipient2?.status || null,
            recipient1_bounced: recipient1?.bounced || false,
            recipient2_bounced: recipient2?.bounced || false,
          };

          await signModel.updateDocumentStatus(doc.document_id, updateData);
          console.log(`[CRON] Updated document ${doc.document_id}`);
          successCount++;
        } catch (innerErr) {
          console.error(`[CRON] Error updating document ${doc.document_id}:`, innerErr.message);
          failureCount++;
        }
      }

      console.log(`[CRON] Completed with ${successCount} success, ${failureCount} failure`);
    } catch (error) {
      console.error("[CRON] Job error:", error.message);
    }
  });
}

module.exports = {
    startScaleStatusCron
}