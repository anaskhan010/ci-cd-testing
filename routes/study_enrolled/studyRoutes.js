const express = require("express");

const studyEnrolledController = require("../../controllers/study_enrolled/studyController");

const router = express.Router();

router.post("/createStudy", studyEnrolledController.createStudy);
router.get("/getAllStudy", studyEnrolledController.getAllStudyController);
router.get("/getStudyById/:id", studyEnrolledController.getStudyByIdController);
router.put("/updateStudy", studyEnrolledController.updateStudyController);
router.get("/countstudy", studyEnrolledController.countStudyController);
router.get("/fetchUserStudies/:id", studyEnrolledController.fetchUserStudies);
router.get(
  "/fetchAllStudySchedules",
  studyEnrolledController.fetchScheduleNames
);

// New endpoint to check and update study statuses based on end date
router.get(
  "/check-expired-studies",
  studyEnrolledController.checkAndUpdateStudyStatus
);

module.exports = router;
