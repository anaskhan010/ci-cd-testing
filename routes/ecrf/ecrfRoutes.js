// ecrfRoutes.js
const express = require("express");
const router = express.Router();
const ecrfController = require("../../controllers/ecrf/ecrfController");

// Create ECRF question
router.post("/questions", ecrfController.createEcrfQuestion);

// Get all ECRF questions
router.get("/questions", ecrfController.getAllEcrfQuestions);

// Submit ECRF answers
router.post("/submissions", ecrfController.submitEcrfAnswers);

// Get ECRF submissions by ticket
router.get("/submissions/:ticketId", ecrfController.getEcrfSubmissionsByTicket);

module.exports = router;
