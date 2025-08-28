const manual_api_call_models = require("../../models/manual_api_calls/manual_api_calls_model");

const manual_api_calls_controller = async (req, res) => {
  const { personel_id, study_id, site_id } = req.body;
  try {
    const study_ids = Array.isArray(study_id) ? study_id : [study_id];
    const site_ids = Array.isArray(site_id) ? site_id : [site_id];

    const result = await manual_api_call_models.manual_api_calls_model(
      personel_id,
      study_ids,
      site_ids
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in manual_api_calls_controller:", error);
    res.status(500).json({
      error: error.message || "An error occurred during the API call",
    });
  }
};

const getDayNameScheduleNameTableController = async (req, res) => {
  try {
    const result = await manual_api_call_models.getDayNameScheduleNameTable();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

const assignScaleToDaysController = async (req, res) => {
  try {
    const { assignments } = req.body;

    // Validate input
    if (!assignments || !Array.isArray(assignments)) {
      return res
        .status(400)
        .json({ error: "Invalid input. Expected 'assignments' array." });
    }

    // Process all assignments
    const results = await manual_api_call_models.assignScaleToDays(assignments);
    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  manual_api_calls_controller,
  getDayNameScheduleNameTableController,
  assignScaleToDaysController,
};
