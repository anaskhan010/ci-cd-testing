const db = require("../../config/DBConnection3.js");
const crypto = require("crypto");

const getAllLogs = async (
  limit,
  offset,
  filters,
  searchKeyword,
  searchFields
) => {
  let query = `SELECT 
    id,
    method,
    api_url,
    table_name,
    operation,
    description,
    old_value,
    new_value,
    browser,
    ip_address,
    user,
    DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.000Z') AS timestamp 
FROM 
    audit_logs
`;
  const whereClauses = [];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation"];

  // 1. Apply Specific Filters
  Object.keys(filters).forEach((key) => {
    if (likeFields.includes(key)) {
      whereClauses.push(`${key} LIKE ?`);
      queryParams.push(`%${filters[key]}%`);
    } else if (key === "id") {
      whereClauses.push(`${key} = ?`);
      queryParams.push(parseInt(filters[key], 10));
    } else if (key === "timestamp") {
      // Handle exact match or implement range filtering if needed
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    } else {
      // For other string fields, use exact match
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    }
  });

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(searchKeyword);
    });
  }

  // 3. Construct WHERE Clause
  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  // 4. Append ORDER BY, LIMIT, and OFFSET
  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  queryParams.push(limit, offset);

  try {
    const [rows] = await db.query(query, queryParams);
    return rows;
  } catch (err) {
    console.error("Error in fetchAllLogs:", err);
    throw err;
  }
};

const getLogsCount = async (filters, searchKeyword, searchFields) => {
  let query = "SELECT COUNT(*) as count FROM audit_logs";
  const whereClauses = [];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation"];

  // 1. Apply Specific Filters
  Object.keys(filters).forEach((key) => {
    if (likeFields.includes(key)) {
      whereClauses.push(`${key} LIKE ?`);
      queryParams.push(`%${filters[key]}%`);
    } else if (key === "id") {
      whereClauses.push(`${key} = ?`);
      queryParams.push(parseInt(filters[key], 10));
    } else if (key === "timestamp") {
      // Handle exact match or implement range filtering if needed
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    } else {
      // For other string fields, use exact match
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    }
  });

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(searchKeyword);
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
    console.error("Error in fetchLogsCount:", err);
    throw err;
  }
};
async function getLogsModel() {
  const query = `SELECT 
    id,
    method,
    api_url,
    table_name,
    operation,
    description,
    old_value,
    new_value,
    browser,
    ip_address,
    user,
    DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.000Z') AS timestamp 
FROM 
    audit_logs
`;
  try {
    const [rows] = await db.query(query);
    return rows;
  } catch (err) {
    throw err;
  }
}

const getAllLogsForCurrentDay = async (
  limit,
  offset,
  filters,
  searchKeyword,
  searchFields
) => {
  let query = `SELECT 
    id,
    method,
    api_url,
    table_name,
    operation,
    description,
    old_value,
    new_value,
    browser,
    ip_address,
    user,
    DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.000Z') AS timestamp 
FROM 
    audit_logs
`;
  // We ensure we only get logs for the current day
  const whereClauses = ["DATE(timestamp) = CURRENT_DATE"];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation"];

  // 1. Apply Specific Filters
  Object.keys(filters).forEach((key) => {
    if (likeFields.includes(key)) {
      whereClauses.push(`${key} LIKE ?`);
      queryParams.push(`%${filters[key]}%`);
    } else if (key === "id") {
      whereClauses.push(`${key} = ?`);
      queryParams.push(parseInt(filters[key], 10));
    } else if (key === "timestamp") {
      // If you need exact match or range
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    } else {
      // For other string fields, use exact match
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    }
  });

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(searchKeyword);
    });
  }

  // 3. Construct WHERE Clause
  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  // 4. Append ORDER BY, LIMIT, and OFFSET
  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  queryParams.push(limit, offset);

  try {
    const [rows] = await db.query(query, queryParams);
    return rows;
  } catch (err) {
    console.error("Error in getAllLogsForCurrentDay:", err);
    throw err;
  }
};

// 2. Count Logs For Current Day
const getLogsCountForCurrentDay = async (
  filters,
  searchKeyword,
  searchFields
) => {
  let query = "SELECT COUNT(*) as count FROM audit_logs";
  const whereClauses = ["DATE(timestamp) = CURRENT_DATE"];
  const queryParams = [];

  // Define fields that should use LIKE for partial matches
  const likeFields = ["user", "operation"];

  // 1. Apply Specific Filters
  Object.keys(filters).forEach((key) => {
    if (likeFields.includes(key)) {
      whereClauses.push(`${key} LIKE ?`);
      queryParams.push(`%${filters[key]}%`);
    } else if (key === "id") {
      whereClauses.push(`${key} = ?`);
      queryParams.push(parseInt(filters[key], 10));
    } else if (key === "timestamp") {
      // If you need exact match or range
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    } else {
      // For other string fields, use exact match
      whereClauses.push(`${key} = ?`);
      queryParams.push(filters[key]);
    }
  });

  // 2. Apply 'search' Keyword
  if (searchKeyword && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => `${field} LIKE ?`);
    whereClauses.push(`(${searchConditions.join(" OR ")})`);
    searchFields.forEach(() => {
      queryParams.push(searchKeyword);
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
    console.error("Error in getLogsCountForCurrentDay:", err);
    throw err;
  }
};

module.exports = {
  getAllLogs,
  getLogsCount,
  getLogsModel,
  getAllLogsForCurrentDay,
  getLogsCountForCurrentDay,
};
