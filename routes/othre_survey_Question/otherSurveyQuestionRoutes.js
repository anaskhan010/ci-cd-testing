const express = require("express");

const {
  OtherSurveyQuestion,
  getAllQuestionsWithOptionsController,
  createResponseOtherQuestionController,
} = require("../../controllers/other_survey_Question/otherSuveryQuestionController");

const router = express.Router();

router.post("/otherSurveyQuestion", OtherSurveyQuestion);
router.get("/getAllQuestionsWithOptions", getAllQuestionsWithOptionsController);

router.post(
  "/createResponseOtherQuestion",
  createResponseOtherQuestionController
);

module.exports = router;
