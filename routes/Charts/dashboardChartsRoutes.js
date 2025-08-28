const express = require("express");
const dashboardChartsController = require("../../controllers/Charts/dashboardChartsController");

const router = express.Router();

router.get(
  "/subject_chart",
  dashboardChartsController.subject_chart_controller
);

module.exports = router;
