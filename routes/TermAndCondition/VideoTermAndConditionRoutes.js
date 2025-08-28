const express = require("express");

const VideoTermAndConditionController = require("../../controllers/TermAndCondition/videoTermAndConditionController");

const router = express.Router();

router.post(
  "/createterms",
  VideoTermAndConditionController.createTermAndConditionController
);

router.get(
  "/getvideoterms",
  VideoTermAndConditionController.getAllQuestionsWithOptionsController
);

router.post(
  "/createresponse",
  VideoTermAndConditionController.createResponseController
);

module.exports = router;
