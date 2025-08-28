const express = require("express");
const nonComplaintController = require("../../controllers/non_complaint/non_complaint_controller");

const router = express.Router();

router.put(
  "/make_compliant/:id",
  nonComplaintController.make_compliant_controller
);

router.get(
  "/get_non_complaint",
  nonComplaintController.non_complaint_controller
);

module.exports = router;
