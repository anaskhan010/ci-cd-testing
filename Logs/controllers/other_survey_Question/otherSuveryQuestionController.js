const OtherSurveyQuestionModel = require("../../models/other_survey_Question/otherSurveyQuestionModel");

const OtherSurveyQuestion = async (req, res) => {
  const { questions, study_enrolled_id } = req.body;

  try {
    const result = await OtherSurveyQuestionModel.OtherSurveyQuestion(
      questions,
      study_enrolled_id
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllQuestionsWithOptionsController = async (req, res) => {
  try {
    const questions =
      await OtherSurveyQuestionModel.getAllQuestionsWithOptions();
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ========================= Create Response other Survey Question Controller ========================

const createResponseOtherQuestionController = async (req, res) => {
  const { responses } = req.body;

  try {
    const result = await OtherSurveyQuestionModel.createResponseOtherSurvey(
      responses
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  OtherSurveyQuestion,
  getAllQuestionsWithOptionsController,
  createResponseOtherQuestionController,
};
