const enhancedLogsModel = require("../../models/Logs/enhancedLogsModel");

const getEnhancedLogs = async (req, res) => {
  try {
    // 1. Extract Query Parameters
    const {
      page = 1,
      limit = 50,
      module,
      operation,
      table_name,
      user,
      record_id,
      start_date,
      end_date,
      search,
    } = req.query;

    // 2. Calculate Offset
    const offset = (page - 1) * limit;

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log(decoded);
    const userId = decoded.user_id;

    // 3. Build Filters Object
    const appliedFilters = {};
    if (module) appliedFilters.module = module;
    if (operation) appliedFilters.operation = operation;
    if (table_name) appliedFilters.table_name = table_name;
    if (user) appliedFilters.user = user;
    if (userId) appliedFilters.userId = userId;
    if (record_id) appliedFilters.record_id = record_id;

    // Add date range filter if provided
    if (start_date && end_date) {
      appliedFilters.timestamp = { start: start_date, end: end_date };
      // This will be handled specially in the model
    }

    // 4. Define Search Fields
    const searchFields = [
      "description",
      "operation",
      "method",
      "api_url",
      "table_name",
      "module",
      "browser",
      "ip_address",
      "user",
    ];

    // 5. Format Search Keyword
    let searchKeyword = search ? search : null;

    // 6. Fetch Logs and Total Count
    const [logs, totalLogs] = await Promise.all([
      enhancedLogsModel.getAllEnhancedLogs(
        limit,
        offset,
        appliedFilters,
        searchKeyword,
        searchFields
      ),
      enhancedLogsModel.getEnhancedLogsCount(
        appliedFilters,
        searchKeyword,
        searchFields
      ),
    ]);

    // 7. Calculate Pagination Info
    const totalPages = Math.ceil(totalLogs / limit);

    // 8. Return Response
    res.status(200).json({
      totalPages,
      currentPage: parseInt(page),
      totalLogs,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      logs,
    });
  } catch (error) {
    console.error("Error in getEnhancedLogs:", error);
    res.status(500).json({
      message: "Failed to retrieve logs",
      error: error.message,
    });
  }
};

/**
 * Get logs for a specific date range
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with logs
 */
const getLogsByDateRange = async (req, res) => {
  try {
    const { start_date, end_date, page = 1, limit = 50 } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "Start date and end date are required",
      });
    }

    const offset = (page - 1) * limit;
    const logs = await enhancedLogsModel.getLogsByDateRange(
      start_date,
      end_date,
      limit,
      offset
    );

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error in getLogsByDateRange:", error);
    res.status(500).json({
      message: "Failed to retrieve logs by date range",
      error: error.message,
    });
  }
};

const getLogsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!user_id) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const offset = (page - 1) * limit;
    const logs = await enhancedLogsModel.getLogsByUser(user_id, limit, offset);

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error in getLogsByUser:", error);
    res.status(500).json({
      message: "Failed to retrieve logs by user",
      error: error.message,
    });
  }
};

const getLogsByModule = async (req, res) => {
  try {
    const { module } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!module) {
      return res.status(400).json({
        message: "Module name is required",
      });
    }

    const offset = (page - 1) * limit;
    const logs = await enhancedLogsModel.getLogsByModule(module, limit, offset);

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error in getLogsByModule:", error);
    res.status(500).json({
      message: "Failed to retrieve logs by module",
      error: error.message,
    });
  }
};

/**
 * Get logs for a specific record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with logs
 */
const getLogsByRecord = async (req, res) => {
  try {
    const { record_id, table_name } = req.params;

    if (!record_id || !table_name) {
      return res.status(400).json({
        message: "Record ID and table name are required",
      });
    }

    const logs = await enhancedLogsModel.getLogsByRecord(record_id, table_name);

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error in getLogsByRecord:", error);
    res.status(500).json({
      message: "Failed to retrieve logs by record",
      error: error.message,
    });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const [modules, operations, tables] = await Promise.all([
      enhancedLogsModel.getAllModules(),
      enhancedLogsModel.getAllOperations(),
      enhancedLogsModel.getAllTables(),
    ]);

    res.status(200).json({
      modules,
      operations,
      tables,
    });
  } catch (error) {
    console.error("Error in getFilterOptions:", error);
    res.status(500).json({
      message: "Failed to retrieve filter options",
      error: error.message,
    });
  }
};

const exportLogs = async (req, res) => {
  try {
    const {
      module,
      operation,
      table_name,
      user,
      user_id,
      record_id,
      start_date,
      end_date,
    } = req.query;

    // Build filters object
    const filters = {};
    if (module) filters.module = module;
    if (operation) filters.operation = operation;
    if (table_name) filters.table_name = table_name;
    if (user) filters.user = user;
    if (user_id) filters.user_id = user_id;
    if (record_id) filters.record_id = record_id;
    if (start_date && end_date) {
      filters.timestamp = { start: start_date, end: end_date };
    }

    // Export logs to Excel
    const filePath = await enhancedLogsModel.exportLogsToExcel(filters);

    // Return file path
    res.status(200).json({
      message: "Logs exported successfully",
      filePath,
    });
  } catch (error) {
    console.error("Error in exportLogs:", error);
    res.status(500).json({
      message: "Failed to export logs",
      error: error.message,
    });
  }
};

module.exports = {
  getEnhancedLogs,
  getLogsByDateRange,
  getLogsByUser,
  getLogsByModule,
  getLogsByRecord,
  getFilterOptions,
  exportLogs,
};
