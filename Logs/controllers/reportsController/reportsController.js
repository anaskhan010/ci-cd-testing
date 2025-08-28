const reportModel = require("../../models/reportsModel/reportsModel");

const getScaleReportController = async (req, res) => {
  try {
    const scaleReport = await reportModel.getScaleReportModel();
    res.status(200).json(scaleReport);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getScaleReportController,
};
