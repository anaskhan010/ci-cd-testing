const express = require("express");
const manual_api_calls_controller = require("../../controllers/manual_api_calls/manual_api_calls_controller");

const router = express.Router();

router.post(
  "/assign-study-sites",
  manual_api_calls_controller.manual_api_calls_controller
);

router.get(
  "/assign-scale-to-days",
  manual_api_calls_controller.getDayNameScheduleNameTableController
);

router.post(
  "/assign-scale-to-days",
  manual_api_calls_controller.assignScaleToDaysController
);

module.exports = router;
