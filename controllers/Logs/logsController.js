const logsModel = require("../../models/Logs/logsModel");

const getAllLogs = async (req, res) => {
  try {
    // 1. Extract Pagination Parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100); // Max limit of 100
    const offset = (page - 1) * limit;

    const { page: _, limit: __, search, ...filters } = req.query;

    const allowedFilters = [
      "id",
      "method",
      "api_url",
      "table_name",
      "operation",
      "description",
      "browser",
      "ip_address",
      "user",
      "timestamp",
    ];

    const appliedFilters = {};
    Object.keys(filters).forEach((key) => {
      if (allowedFilters.includes(key)) {
        appliedFilters[key] = filters[key];
      }
    });

    // 5. Handle 'search' Parameter
    const searchFields = [
      "description",
      "operation",
      "method",
      "api_url",
      "table_name",
      "browser",
      "ip_address",
      "user",
    ];
    let searchKeyword = null;
    if (search) {
      searchKeyword = `%${search}%`;
    }

    // 6. Fetch Logs and Total Count
    const [logs, totalLogs] = await Promise.all([
      logsModel.getAllLogs(
        limit,
        offset,
        appliedFilters,
        searchKeyword,
        searchFields
      ),
      logsModel.getLogsCount(appliedFilters, searchKeyword, searchFields),
    ]);

    // 7. Calculate Total Pages
    const totalPages = Math.ceil(totalLogs / limit);

    // 8. Respond with Logs and Pagination Info
    res.status(200).json({
      totalPages,
      currentPage: page,
      totalLogs,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      logs,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getLogs = async (req, res) => {
  try {
    const result = await logsModel.getLogsModel();
    res.status(200).json(result);
  } catch (error) {
    res.status(404).json(error);
  }
};

const getAllLogsForToday = async (req, res) => {
  try {
    // 1. Extract Pagination Parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100); // Max limit of 100
    const offset = (page - 1) * limit;

    // Remove page and limit from filters
    const { page: _, limit: __, search, ...filters } = req.query;

    // 2. Define the filters that are allowed in query
    const allowedFilters = [
      "id",
      "method",
      "api_url",
      "table_name",
      "operation",
      "description",
      "browser",
      "ip_address",
      "user",
      "timestamp",
    ];

    const appliedFilters = {};
    Object.keys(filters).forEach((key) => {
      if (allowedFilters.includes(key)) {
        appliedFilters[key] = filters[key];
      }
    });

    // 3. Handle 'search' Parameter
    const searchFields = [
      "description",
      "operation",
      "method",
      "api_url",
      "table_name",
      "browser",
      "ip_address",
      "user",
    ];

    let searchKeyword = null;
    if (search) {
      searchKeyword = `%${search}%`;
    }

    // 4. Fetch Today’s Logs and Total Count
    const [logs, totalLogs] = await Promise.all([
      logsModel.getAllLogsForCurrentDay(
        limit,
        offset,
        appliedFilters,
        searchKeyword,
        searchFields
      ),
      logsModel.getLogsCountForCurrentDay(
        appliedFilters,
        searchKeyword,
        searchFields
      ),
    ]);

    // 5. Calculate Total Pages
    const totalPages = Math.ceil(totalLogs / limit);

    // 6. Respond with Logs and Pagination Info
    res.status(200).json({
      totalPages,
      currentPage: page,
      totalLogs,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      logs,
    });
  } catch (error) {
    console.error("Error fetching logs for today:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getAllLogs,
  getLogs,
  getAllLogsForToday,
};
