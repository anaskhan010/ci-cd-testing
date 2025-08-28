const express = require("express");

const EmergencyEmailController = require("../../controllers/EmergencyEmail/EmergencyEmailController");

const router = express.Router();

router.post(
  "/emergencyEmail",
  EmergencyEmailController.emergencyEmailController
);

module.exports = router;
