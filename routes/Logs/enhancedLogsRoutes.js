const express = require("express");
const enhancedLogsController = require("../../controllers/Logs/enhancedLogsController");
const router = express.Router();

// Get all logs with pagination, filtering, and search
router.get("/", enhancedLogsController.getEnhancedLogs);

// Get logs by date range
router.get("/date-range", enhancedLogsController.getLogsByDateRange);

// Get logs by user
router.get("/user/:user_id", enhancedLogsController.getLogsByUser);

// Get logs by module
router.get("/module/:module", enhancedLogsController.getLogsByModule);

// Get logs by record
router.get("/record/:table_name/:record_id", enhancedLogsController.getLogsByRecord);

// Get filter options (modules, operations, tables)
router.get("/filter-options", enhancedLogsController.getFilterOptions);

// Export logs to Excel
router.get("/export", enhancedLogsController.exportLogs);

module.exports = router;
