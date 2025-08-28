const express = require("express");
const reportsController = require("../../controllers/reportsController/reportsController");

const router = express.Router();

router.get("/get-report", reportsController.getScaleReportController);

module.exports = router;
