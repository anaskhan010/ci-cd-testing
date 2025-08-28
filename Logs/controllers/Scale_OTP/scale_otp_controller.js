const scale_otp_model = require("../../models/Scale_OTP/scale_otp_model");
const Scale_OTP_Email = require("../../middleware/Scale_OTP_Email");
const organizationModel = require("../../models/organization/organizationModel");

const generateAndSendOtp = async (req, res) => {
  try {
    const { user_id } = req.body;

    console.log(user_id, "controller");

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);

    await scale_otp_model.sendOtpToUser(user_id, otp, expireAt);

    const user = await organizationModel.getOrganizationById(user_id, user_id);
    const { email } = user;
    const subject = "OTP for Scale";

    await Scale_OTP_Email(email, subject, otp);

    res.status(200).json({ message: "OTP has been sent successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyUserOtp = async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({ message: "User ID and OTP are required." });
    }

    // Verify the OTP
    const verificationResult = await scale_otp_model.verifyOtp(user_id, otp);

    res.status(200).json({ message: verificationResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllInvestigatorsByStudyIdsController = async (req, res) => {
  try {
    const { studyIds } = req.body; // Assumes study_ids are passed in the request body as an array
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Study IDs must be provided in an array." });
    }

    const investigatorList =
      await scale_otp_model.getAllInvestigatorsByStudyIds(studyIds);
    res.status(200).json(investigatorList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateAndSendOtp,
  verifyUserOtp,
  getAllInvestigatorsByStudyIdsController,
};
