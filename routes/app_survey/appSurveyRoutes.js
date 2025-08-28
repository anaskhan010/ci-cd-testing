const express = require("express");
const router = express.Router();
// app survey controller
const {
  createSurveyQuestionsController,
  getSurveyQuestionsController,
  deleteSurveyByIdController,
  submitSurveyResponseController,
  getSurveyDetailsController,
  getAllSurveysController,
  getAllSurveysForInvestigatorController,
  getSurveysByUserIdController,
  createScaleController,
  getScaleController,
  getScaleCount,
  getAllScalesController,
  getScaleName,
  getScalebyScaleID,
  submitSurveyResponseControllerforportal,
  getScaleuser,
  updateScaleController,
  getScaleByIdController,
  getquestionresponseforportal,
  submitMobileModelResposneController,
  createSpanishScaleController,
  getAllSpanishScalesController,
  createRomanionScaleController,
  getAllRomanionScalesController,
  getSpanishScaleName,
  getSpanishScaleByIdController,
  getExcelFileController,
  getAllPatientsResponsess,
  archivalScaleChangeStatus,
  deleteScale,
} = require("../../controllers/app_survey/appSurveyController");

const mannual_pdf_create_controller = require("../../controllers/app_survey/mannual_pdf_create_controller");

// const scaleSchedule = require("../../controllers/Scale_Schedule/scaleSchedule");

const auditLog = require("../../middleware/audit_logger");

router.get("/getAllSurveys", getAllSurveysController);

// get all surveys for the investigator
router.get(
  "/getAllSurveysForInvestigatorController/:id",
  getAllSurveysForInvestigatorController
);
router.delete(
  "/deleteSurveyById/:survey_id",
  auditLog("create", "delete"),
  deleteSurveyByIdController
);
router.get("/getSurveysByUserId/:user_id", getSurveysByUserIdController);
router.get("/getSurveyDetails/:user_id", getSurveyDetailsController);

router.post(
  "/createSurveyQuestion",

  createSurveyQuestionsController
);
router.get("/getSurveyQuestions", getSurveyQuestionsController);
router.post(
  "/submitSurveyResponse",

  submitSurveyResponseController
);

router.post(
  "/submitscalequestionresponse",

  submitSurveyResponseControllerforportal
);

router.post("/createScale", createScaleController);
router.post("/createSpanishScale", createSpanishScaleController);
router.get("/getSpanishScale/:scale_id", getAllSpanishScalesController);
router.get("/getSpanishScaleName", getSpanishScaleName);

router.post("/createRomanionScale", createRomanionScaleController);
router.get("/getRomanionScale/:scale_id", getAllRomanionScalesController);

router.get("/getScaleByScaleId/:scale_id", getScaleController);
router.get(
  "/getSpanishScaleByScaleId/:scale_id",
  getSpanishScaleByIdController
);
router.get("/countscales", getScaleCount);
router.get("/getAllScales", getAllScalesController);
router.get("/getScaleName", getScaleName);
router.get("/getScalebyid/:id", getScalebyScaleID);

router.get("/getuserscales/:id", getScaleuser);
router.put("/updateScale", updateScaleController);
router.get("/getScale/:id", getScaleByIdController);
router.get("/getquestionresponsebyuserid/:id", getquestionresponseforportal);
router.post(
  "/submitMobileAppModelResponse",
  submitMobileModelResposneController
);

router.get("/getExcelFile/:doc_id", getExcelFileController);
router.get("/getAllPatientsResponses/:scale_id", getAllPatientsResponsess);

router.post("/disable-scale-status", archivalScaleChangeStatus);

router.delete("/deleteScale/:scale_id", deleteScale);

router.post(
  "/manual_pdf_generate",
  mannual_pdf_create_controller.downloadSurveyPDF
);

module.exports = router;
