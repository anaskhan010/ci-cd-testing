const vedioTermAndConditionModel = require("../../models/TermAndCondition/videoTermAndConditionModel");

const createTermAndConditionController = async (req, res) => {
  const { questions } = req.body;

  try {
    const result = await vedioTermAndConditionModel.createTermAndCondition(
      questions
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
      await vedioTermAndConditionModel.getAllQuestionsWithOptions();
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const createResponseController = async (req, res) => {
  const { responses } = req.body;

  try {
    const result = await vedioTermAndConditionModel.createResponse(responses);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createTermAndConditionController,
  getAllQuestionsWithOptionsController,
  createResponseController,
};
