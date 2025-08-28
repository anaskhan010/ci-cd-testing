// controllers/surveyController.js

const { generateSurveyPDF } = require("../../models/app_survey/util");
const SurveyResponsesModel = require("../../models/app_survey/mannual_pdf_create_model");

async function downloadSurveyPDF(req, res) {
  try {
    const { user_id, scale_id, day_id, created_at } = req.body;
    if (![user_id, scale_id, day_id, created_at].every(Boolean)) {
      return res.status(400).json({
        error: "user_id, scale_id, day_id and created_at are required.",
      });
    }

    // 1. Load all survey responses for exactly that timestamp
    const rows = await SurveyResponsesModel.getResponses(
      Number(user_id),
      Number(scale_id),
      Number(day_id),
      created_at.trim()
    );
    if (!rows.length) {
      return res.status(404).json({ message: "No survey responses found." });
    }

    // 2. Build the array we’ll render into the PDF
    const enhancedSurveyResponses = rows.map((r) => ({
      question_text: r.question_text,
      option_text: r.option_text,
      description: r.description,
      option_id: r.option_id,
    }));

    // 3. Pull all metadata from the very first row
    const {
      scale_name,
      schedule_name,
      day_name,
      filled_by,
      ecrf_id,
      investigator_first_name,
      investigator_last_name,
    } = rows[0];

    // 4. Construct a minimal investigator object for PDF header
    const investigator = {
      first_name: investigator_first_name,
      last_name: investigator_last_name,
    };

    // 5. Compute total score if you need it
    const totalScore = enhancedSurveyResponses.reduce((sum, resp) => {
      const v = parseFloat(resp.option_text) || 0;
      return sum + v;
    }, 0);

    // 6. Generate the PDF buffer
    const pdfBuffer = await generateSurveyPDF(
      scale_id,
      enhancedSurveyResponses,
      investigator,
      scale_name,
      ecrf_id,
      filled_by,
      day_name,
      schedule_name,
      totalScore
    );

    // 7. Send it back as a downloadable PDF
    const filename = `survey_${user_id}_${scale_id}_${day_id}.pdf`;
    res
      .setHeader("Content-Type", "application/pdf")
      .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      .send(pdfBuffer);
  } catch (err) {
    console.error("Error in downloadSurveyPDF:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

module.exports = { downloadSurveyPDF };
