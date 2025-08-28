const express = require("express");
const logsController = require("../../controllers/Logs/logsController");

const router = express.Router();

router.get("/getlogs", logsController.getAllLogs);
router.get("/getalllogs", logsController.getLogs);
router.get("/get-today-logs", logsController.getAllLogsForToday);
module.exports = router;
