const logger = require("./logger");
const db = require("../config/DBConnection3.js");
const useragent = require("useragent");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");

const getTodayFolder = () => {
  const today = moment().format("YYYY-MM-DD");
  const logsBaseDir = path.join(__dirname, "../Logs");
  const todayFolder = path.join(logsBaseDir, today);

  if (!fs.existsSync(todayFolder)) {
    fs.mkdirSync(todayFolder, { recursive: true });
  }

  return todayFolder;
};

// Cache the workbook to prevent constant file operations
let cachedWorkbook = null;
let cachedWorkbookDate = null;

const appendToXLSX = async (logEntry) => {
  try {
    const todayFolder = getTodayFolder();
    const xlsxPath = path.join(todayFolder, "audit_logs.xlsx");
    const today = moment().format("YYYY-MM-DD");

    // Always create a new workbook instance for each operation
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    // Check if file exists and load it
    if (fs.existsSync(xlsxPath)) {
      try {
        await workbook.xlsx.readFile(xlsxPath);
        worksheet = workbook.getWorksheet("Audit Logs");
        console.log(`Existing file found. Current rows: ${worksheet.rowCount}`);
      } catch (error) {
        console.error("Error reading existing file:", error);
        worksheet = workbook.addWorksheet("Audit Logs");
      }
    } else {
      worksheet = workbook.addWorksheet("Audit Logs");
    }

    // If worksheet is new or empty, add headers
    if (worksheet.rowCount === 0) {
      // Define columns with keys
      worksheet.columns = [
        { header: "Timestamp", key: "timestamp", width: 20 },
        { header: "Method", key: "method", width: 10 },
        { header: "API URL", key: "api_url", width: 30 },
        { header: "Table Name", key: "table_name", width: 15 },
        { header: "Operation", key: "operation", width: 15 },
        { header: "Description", key: "description", width: 30 },
        { header: "Old Value", key: "old_value", width: 30 },
        { header: "New Value", key: "new_value", width: 30 },
        { header: "Browser", key: "browser", width: 20 },
        { header: "IP Address", key: "ip_address", width: 15 },
        { header: "User", key: "user", width: 20 },
      ];

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" },
      };
      await headerRow.commit();
    }

    // Prepare row data
    const rowData = [
      moment().format("YYYY-MM-DD HH:mm:ss"),
      logEntry.method,
      logEntry.api_url,
      logEntry.table_name,
      logEntry.operation,
      logEntry.description,
      logEntry.old_value,
      logEntry.new_value,
      logEntry.browser,
      logEntry.ip_address,
      logEntry.user,
    ];

    // Add the new row using array values
    const newRow = worksheet.addRow(rowData);
    await newRow.commit();

    // Update auto-filter range
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: worksheet.rowCount, column: worksheet.columnCount },
    };

    // Save changes to file with a promise
    await new Promise((resolve, reject) => {
      workbook.xlsx
        .writeFile(xlsxPath)
        .then(() => {
          console.log(
            `Row added successfully. Total rows: ${worksheet.rowCount}`
          );
          resolve();
        })
        .catch((error) => {
          console.error("Error writing to file:", error);
          reject(error);
        });
    });

    // Double-check file was written correctly
    const verifyWorkbook = new ExcelJS.Workbook();
    await verifyWorkbook.xlsx.readFile(xlsxPath);
    const verifySheet = verifyWorkbook.getWorksheet("Audit Logs");
    console.log(`Verification: File has ${verifySheet.rowCount} rows`);
  } catch (error) {
    console.error("Error in appendToXLSX:", error);
    throw error;
  }
};

const auditLog = (
  operation,
  tableName,
  oldValue = null,
  newValue = null,
  reason,
  optionalToken = null
) => {
  console.log("Audit log function called");
  return async (req, res, next) => {
    try {
      const agent = useragent.parse(req.headers["user-agent"]);
      const browser = `${agent.family} ${agent.major}.${agent.minor}.${agent.patch}`;
      // Extract real client IP address with proper precedence
      const getClientIP = (req) => {
        const os = require('os');

        // Get IP from headers first (for proxied requests)
        let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                 req.headers['x-real-ip'] ||
                 req.headers['x-client-ip'] ||
                 req.connection.remoteAddress ||
                 req.socket.remoteAddress ||
                 req.ip;

        // If we get localhost/loopback addresses, try to get the actual system IP
        if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || !ip) {
          const networkInterfaces = os.networkInterfaces();

          // Look for the first non-internal IPv4 address
          for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            for (const address of addresses) {
              if (address.family === 'IPv4' && !address.internal) {
                return address.address;
              }
            }
          }

          // If no external IPv4 found, look for non-loopback IPv6
          for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            for (const address of addresses) {
              if (address.family === 'IPv6' && !address.internal && address.address !== '::1') {
                return address.address;
              }
            }
          }
        }

        return ip || 'unknown';
      };

      const ipAddress = getClientIP(req);

      // Get user information - either from token or from request body for invalid password cases
      let userEmail = null;

      // First try to get from authorization header
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token) {
        try {
          // If there's a valid token, try to decode it
          const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
          userEmail = decoded.email;
        } catch (error) {
          console.log("Token verification error:", error.message);
          // Continue with other methods if token is invalid
        }
      }

      // If optionalToken is provided (for successful logins)
      if (!userEmail && optionalToken) {
        try {
          const decoded = jwt.verify(optionalToken, "HJSDHDSLDLSDJSL");
          userEmail = decoded.email;
        } catch (error) {
          console.log("Optional token verification error:", error.message);
        }
      }

      // For invalid password cases, use the email from request body
      if (!userEmail && req.body && req.body.email) {
        userEmail = req.body.email;
        console.log("Using email from request body:", userEmail);
      }

      const logEntry = {
        method: req.method,
        api_url: req.originalUrl,
        table_name: tableName,
        operation: operation,
        description: reason,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        browser: browser,
        ip_address: ipAddress,
        user: userEmail,
      };

      console.log("Creating log entry:", logEntry);

      // Log to Winston logger
      logger.info(JSON.stringify(logEntry));

      // Insert into database
      const query = `INSERT INTO audit_logs (method, api_url, table_name, operation, description, old_value, new_value, browser, ip_address, user) VALUES (?,?,?,?,?,?,?,?,?,?)`;
      const values = [
        logEntry.method,
        logEntry.api_url,
        logEntry.table_name,
        logEntry.operation,
        logEntry.description,
        logEntry.old_value,
        logEntry.new_value,
        logEntry.browser,
        logEntry.ip_address,
        logEntry.user,
      ];

      await db.query(query, values);
      await appendToXLSX(logEntry);
    } catch (err) {
      console.error("Failed to log to database or Excel:", err);
      logger.error("Failed to log to database or Excel: %s", err.message);
    }

    next();
  };
};

module.exports = auditLog;



// const logger = require("./logger");
// const db = require("../config/DBConnection3.js");
// const useragent = require("useragent");
// const jwt = require("jsonwebtoken");
// const moment = require("moment");
// const path = require("path");
// const ExcelJS = require("exceljs");
// const fs = require("fs");

// const getTodayFolder = () => {
//   const today = moment().format("YYYY-MM-DD");
//   const logsBaseDir = path.join(__dirname, "../Logs");
//   const todayFolder = path.join(logsBaseDir, today);

//   if (!fs.existsSync(todayFolder)) {
//     fs.mkdirSync(todayFolder, { recursive: true });
//   }

//   return todayFolder;
// };

// // Cache the workbook to prevent constant file operations
// let cachedWorkbook = null;
// let cachedWorkbookDate = null;

// const appendToXLSX = async (logEntry) => {
//   try {
//     const todayFolder = getTodayFolder();
//     const xlsxPath = path.join(todayFolder, "audit_logs.xlsx");
//     const today = moment().format("YYYY-MM-DD");

//     // Always create a new workbook instance for each operation
//     const workbook = new ExcelJS.Workbook();
//     let worksheet;

//     // Check if file exists and load it
//     if (fs.existsSync(xlsxPath)) {
//       try {
//         await workbook.xlsx.readFile(xlsxPath);
//         worksheet = workbook.getWorksheet("Audit Logs");
//         console.log(`Existing file found. Current rows: ${worksheet.rowCount}`);
//       } catch (error) {
//         console.error("Error reading existing file:", error);
//         worksheet = workbook.addWorksheet("Audit Logs");
//       }
//     } else {
//       worksheet = workbook.addWorksheet("Audit Logs");
//     }

//     // If worksheet is new or empty, add headers
//     if (worksheet.rowCount === 0) {
//       // Define columns with keys
//       worksheet.columns = [
//         { header: "Timestamp", key: "timestamp", width: 20 },
//         { header: "Method", key: "method", width: 10 },
//         { header: "API URL", key: "api_url", width: 30 },
//         { header: "Table Name", key: "table_name", width: 15 },
//         { header: "Operation", key: "operation", width: 15 },
//         { header: "Description", key: "description", width: 30 },
//         { header: "Old Value", key: "old_value", width: 30 },
//         { header: "New Value", key: "new_value", width: 30 },
//         { header: "Browser", key: "browser", width: 20 },
//         { header: "IP Address", key: "ip_address", width: 15 },
//         { header: "User", key: "user", width: 20 },
//       ];

//       // Style the header row
//       const headerRow = worksheet.getRow(1);
//       headerRow.font = { bold: true };
//       headerRow.fill = {
//         type: "pattern",
//         pattern: "solid",
//         fgColor: { argb: "FFD3D3D3" },
//       };
//       await headerRow.commit();
//     }

//     // Prepare row data
//     const rowData = [
//       moment().format("YYYY-MM-DD HH:mm:ss"),
//       logEntry.method,
//       logEntry.api_url,
//       logEntry.table_name,
//       logEntry.operation,
//       logEntry.description,
//       logEntry.old_value,
//       logEntry.new_value,
//       logEntry.browser,
//       logEntry.ip_address,
//       logEntry.user,
//     ];

//     // Add the new row using array values
//     const newRow = worksheet.addRow(rowData);
//     await newRow.commit();

//     // Update auto-filter range
//     worksheet.autoFilter = {
//       from: { row: 1, column: 1 },
//       to: { row: worksheet.rowCount, column: worksheet.columnCount },
//     };

//     // Save changes to file with a promise
//     await new Promise((resolve, reject) => {
//       workbook.xlsx
//         .writeFile(xlsxPath)
//         .then(() => {
//           console.log(
//             `Row added successfully. Total rows: ${worksheet.rowCount}`
//           );
//           resolve();
//         })
//         .catch((error) => {
//           console.error("Error writing to file:", error);
//           reject(error);
//         });
//     });

//     // Double-check file was written correctly
//     const verifyWorkbook = new ExcelJS.Workbook();
//     await verifyWorkbook.xlsx.readFile(xlsxPath);
//     const verifySheet = verifyWorkbook.getWorksheet("Audit Logs");
//     console.log(`Verification: File has ${verifySheet.rowCount} rows`);
//   } catch (error) {
//     console.error("Error in appendToXLSX:", error);
//     throw error;
//   }
// };

// const auditLog = (
//   operation,
//   tableName,
//   oldValue = null,
//   newValue = null,
//   reason,
//   optionalToken = null
// ) => {
//   console.log("Audit log function called");
//   return async (req, res, next) => {
//     try {
//       const agent = useragent.parse(req.headers["user-agent"]);
//       const browser = `${agent.family} ${agent.major}.${agent.minor}.${agent.patch}`;
//       const ipAddress =
//         req.ip ||
//         req.connection.remoteAddress ||
//         req.headers["x-forwarded-for"];

//       // Get user information - either from token or from request body for invalid password cases
//       let userEmail = null;

//       // First try to get from authorization header
//       const authHeader = req.headers["authorization"];
//       const token = authHeader && authHeader.split(" ")[1];

//       if (token) {
//         try {
//           // If there's a valid token, try to decode it
//           const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//           userEmail = decoded.email;
//         } catch (error) {
//           console.log("Token verification error:", error.message);
//           // Continue with other methods if token is invalid
//         }
//       }

//       // If optionalToken is provided (for successful logins)
//       if (!userEmail && optionalToken) {
//         try {
//           const decoded = jwt.verify(optionalToken, "HJSDHDSLDLSDJSL");
//           userEmail = decoded.email;
//         } catch (error) {
//           console.log("Optional token verification error:", error.message);
//         }
//       }

//       // For invalid password cases, use the email from request body
//       if (!userEmail && req.body && req.body.email) {
//         userEmail = req.body.email;
//         console.log("Using email from request body:", userEmail);
//       }

//       const logEntry = {
//         method: req.method,
//         api_url: req.originalUrl,
//         table_name: tableName,
//         operation: operation,
//         description: reason,
//         old_value: oldValue ? JSON.stringify(oldValue) : null,
//         new_value: newValue ? JSON.stringify(newValue) : null,
//         browser: browser,
//         ip_address: ipAddress,
//         user: userEmail,
//       };

//       console.log("Creating log entry:", logEntry);

//       // Log to Winston logger
//       logger.info(JSON.stringify(logEntry));

//       // Insert into database
//       const query = `INSERT INTO audit_logs (method, api_url, table_name, operation, description, old_value, new_value, browser, ip_address, user) VALUES (?,?,?,?,?,?,?,?,?,?)`;
//       const values = [
//         logEntry.method,
//         logEntry.api_url,
//         logEntry.table_name,
//         logEntry.operation,
//         logEntry.description,
//         logEntry.old_value,
//         logEntry.new_value,
//         logEntry.browser,
//         logEntry.ip_address,
//         logEntry.user,
//       ];

//       await db.query(query, values);
//       await appendToXLSX(logEntry);
//     } catch (err) {
//       console.error("Failed to log to database or Excel:", err);
//       logger.error("Failed to log to database or Excel: %s", err.message);
//     }

//     next();
//   };
// };

// module.exports = auditLog;
