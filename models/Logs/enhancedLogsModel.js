const db = require("../../config/DBConnection3.js");

/**
 * Get all enhanced audit logs with pagination, filtering, and search
 * @param {number} limit - Number of logs per page
 * @param {number} offset - Offset for pagination
 * @param {Object} filters - Filters to apply
 * @param {string} searchKeyword - Search keyword
 * @param {Array} searchFields - Fields to search in
 * @returns {Promise<Array>} - Logs matching the criteria
 */
const getAllEnhancedLogs = async (
  limit,
  offset,
  filters,
  searchKeyword,
  searchFields
) => {
  let query = "SELECT * FROM enhanced_audit_logs";
  const whereClauses = [];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation", "module", "description", "table_name"];

  // 1. Apply Filters
  if (filters && Object.keys(filters).length > 0) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (likeFields.includes(key)) {
          whereClauses.push(`${key} LIKE ?`);
          queryParams.push(`%${value}%`);
        } else {
          whereClauses.push(`${key} = ?`);
          queryParams.push(value);
        }
      }
    }
  }

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(`%${searchKeyword}%`);
    });
  }

  // 3. Construct WHERE Clause
  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  // 4. Add ORDER BY, LIMIT, and OFFSET
  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  queryParams.push(parseInt(limit), parseInt(offset));

  try {
    const [rows] = await db.query(query, queryParams);
    return rows;
  } catch (err) {
    console.error("Error in getAllEnhancedLogs:", err);
    throw err;
  }
};

/**
 * Get count of enhanced audit logs matching filters and search criteria
 * @param {Object} filters - Filters to apply
 * @param {string} searchKeyword - Search keyword
 * @param {Array} searchFields - Fields to search in
 * @returns {Promise<number>} - Count of matching logs
 */
const getEnhancedLogsCount = async (filters, searchKeyword, searchFields) => {
  let query = "SELECT COUNT(*) as count FROM enhanced_audit_logs";
  const whereClauses = [];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation", "module", "description", "table_name"];

  // 1. Apply Filters
  if (filters && Object.keys(filters).length > 0) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        if (likeFields.includes(key)) {
          whereClauses.push(`${key} LIKE ?`);
          queryParams.push(`%${value}%`);
        } else {
          whereClauses.push(`${key} = ?`);
          queryParams.push(value);
        }
      }
    }
  }

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(`%${searchKeyword}%`);
    });
  }

  // 3. Construct WHERE Clause
  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  try {
    const [rows] = await db.query(query, queryParams);
    return rows[0].count;
  } catch (err) {
    console.error("Error in getEnhancedLogsCount:", err);
    throw err;
  }
};

/**
 * Get logs for a specific date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {number} limit - Number of logs per page
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} - Logs within the date range
 */
const getLogsByDateRange = async (startDate, endDate, limit, offset) => {
  const query = `
    SELECT * FROM enhanced_audit_logs 
    WHERE DATE(timestamp) BETWEEN ? AND ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `;
  
  try {
    const [rows] = await db.query(query, [startDate, endDate, parseInt(limit), parseInt(offset)]);
    return rows;
  } catch (err) {
    console.error("Error in getLogsByDateRange:", err);
    throw err;
  }
};

/**
 * Get logs for a specific user
 * @param {number} userId - User ID
 * @param {number} limit - Number of logs per page
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} - Logs for the user
 */
const getLogsByUser = async (userId, limit, offset) => {
  const query = `
    SELECT * FROM enhanced_audit_logs 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `;
  
  try {
    const [rows] = await db.query(query, [userId, parseInt(limit), parseInt(offset)]);
    return rows;
  } catch (err) {
    console.error("Error in getLogsByUser:", err);
    throw err;
  }
};

/**
 * Get logs for a specific module
 * @param {string} module - Module name
 * @param {number} limit - Number of logs per page
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} - Logs for the module
 */
const getLogsByModule = async (module, limit, offset) => {
  const query = `
    SELECT * FROM enhanced_audit_logs 
    WHERE module = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `;
  
  try {
    const [rows] = await db.query(query, [module, parseInt(limit), parseInt(offset)]);
    return rows;
  } catch (err) {
    console.error("Error in getLogsByModule:", err);
    throw err;
  }
};

/**
 * Get logs for a specific record
 * @param {string} recordId - Record ID
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} - Logs for the record
 */
const getLogsByRecord = async (recordId, tableName) => {
  const query = `
    SELECT * FROM enhanced_audit_logs 
    WHERE record_id = ? AND table_name = ? 
    ORDER BY timestamp DESC
  `;
  
  try {
    const [rows] = await db.query(query, [recordId, tableName]);
    return rows;
  } catch (err) {
    console.error("Error in getLogsByRecord:", err);
    throw err;
  }
};

/**
 * Get all available modules in the logs
 * @returns {Promise<Array>} - List of modules
 */
const getAllModules = async () => {
  const query = `
    SELECT DISTINCT module 
    FROM enhanced_audit_logs 
    ORDER BY module
  `;
  
  try {
    const [rows] = await db.query(query);
    return rows.map(row => row.module);
  } catch (err) {
    console.error("Error in getAllModules:", err);
    throw err;
  }
};

/**
 * Get all available operations in the logs
 * @returns {Promise<Array>} - List of operations
 */
const getAllOperations = async () => {
  const query = `
    SELECT DISTINCT operation 
    FROM enhanced_audit_logs 
    ORDER BY operation
  `;
  
  try {
    const [rows] = await db.query(query);
    return rows.map(row => row.operation);
  } catch (err) {
    console.error("Error in getAllOperations:", err);
    throw err;
  }
};

/**
 * Get all available tables in the logs
 * @returns {Promise<Array>} - List of tables
 */
const getAllTables = async () => {
  const query = `
    SELECT DISTINCT table_name 
    FROM enhanced_audit_logs 
    ORDER BY table_name
  `;
  
  try {
    const [rows] = await db.query(query);
    return rows.map(row => row.table_name);
  } catch (err) {
    console.error("Error in getAllTables:", err);
    throw err;
  }
};

/**
 * Export logs to Excel
 * @param {Object} filters - Filters to apply
 * @returns {Promise<string>} - Path to the exported Excel file
 */
const exportLogsToExcel = async (filters) => {
  // Implementation will be added in a separate file
  throw new Error("Not implemented");
};

module.exports = {
  getAllEnhancedLogs,
  getEnhancedLogsCount,
  getLogsByDateRange,
  getLogsByUser,
  getLogsByModule,
  getLogsByRecord,
  getAllModules,
  getAllOperations,
  getAllTables,
  exportLogsToExcel
};
