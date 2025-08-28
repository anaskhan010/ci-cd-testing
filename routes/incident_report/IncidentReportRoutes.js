var incidentReportController = require("../../controllers/incident_report/incidentReportController");
const auditLog = require("../../middleware/audit_logger");
var express = require("express");

var router = express.Router();

// Create a new Survey
router.post(
  "/createIncidentReport",
  auditLog("create", "incident report"),
  incidentReportController.createIncidentReport
);

// Get all Surveys Questions
router.get(
  "/getAllIncidentReportsQuestions",
  incidentReportController.getAllIncidentReports
);

// survey response routes
router.post(
  "/createIncidentReportResponse",

  incidentReportController.createIncidentReportResponse
);

router.get(
  "/getTicketHistory/:ticket_id",
  incidentReportController.getHistoryTicketsController
);

router.post(
  "/update-ticket-history",
  incidentReportController.updateHistoryTicketController
);

// Get all Surveys
router.get(
  "/getAllIncidentReportResponses",
  incidentReportController.getAllIncidentReportResponses
);

// get all incident report responses for investigator
router.get(
  "/getAllIncidentReportResponsesForInvestigator/:id",
  incidentReportController.getAllIncidentReportResponsesForInvestigator
);

// get survey response by user_id
router.get(
  "/getIncidentReportResponseByUserId/:ticket_id",
  incidentReportController.getIncidentReportResponseByUserId
);

router.put(
  "/updateTicketStatus/:ticket_id",
  incidentReportController.updateAdverseEvenetTicketingStatus
);

router.put(
  "/updateAETicketStatus/:ticket_id",
  incidentReportController.updateStatusAdverseEventTicket
);

router.get(
  "/aesi-questions-with-options",
  incidentReportController.getAESIQuestionsWithOptions
);

router.post(
  "/aesi-responses",
  incidentReportController.submitAESIQuestionResponses
);

router.get(
  "/aesi-responses/:ticket_id",
  incidentReportController.getAllAesiQuestionResponses
);

router.get(
  "/incident-logs/:user_id",
  incidentReportController.getIncidentLogsByUserId
);

module.exports = router;
