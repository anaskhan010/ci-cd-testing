// routes.js
const express = require("express");
const router = express.Router();
const {
  generateAndSendOtp,
  verifyUserOtp,
  getAllInvestigatorsByStudyIdsController,
} = require("../../controllers/Scale_OTP/scale_otp_controller");

router.post("/send-otp", generateAndSendOtp);
router.post("/verify-scale-otp", verifyUserOtp);
router.post(
  "/show-investigator-by-study-id",
  getAllInvestigatorsByStudyIdsController
);
module.exports = router;
