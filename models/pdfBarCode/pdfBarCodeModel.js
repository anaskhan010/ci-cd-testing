const db = require("../../config/DBConnection3");
const crypto = require("crypto");

// Encryption configuration and decryption function (adjust the key as needed)
const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16; // For AES, this is always 16

function decrypt(text) {
  if (!text) return text;
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const getFilledPdfDocumentById = async (id) => {
  const query = `SELECT * FROM pdf_barcode_uploaded_documents WHERE id = ?`;
  const [rows] = await db.execute(query, [id]);
  return rows[0];
};

const savePdfForm = async (personnel_id) => {
  console.log(personnel_id, "====model===");
  const query = `INSERT INTO pdf_bar_code (personnel_id) VALUES(?)`;
  const [result] = await db.execute(query, [personnel_id]);
  console.log(result, "=====model result====");
  return result;
};

const createPdfDocument = async (fileName, filePath, departmentId) => {
  // Updated SQL query to include department_id column
  const query = `INSERT INTO pdf_barcode_documents (file_name, file_path, department_id) VALUES (?, ?, ?)`;
  const [result] = await db.execute(query, [fileName, filePath, departmentId]);
  return result;
};

// Get all pdf document records for listing
const getAllPdfDocuments = async (departmentId) => {
  const query = `SELECT pdf_id, file_name, file_path FROM pdf_barcode_documents WHERE department_id = ?`;
  const [rows] = await db.execute(query, [departmentId]);
  return rows;
};

// Get a specific pdf document by id
const getPdfDocumentById = async (id) => {
  const query = `SELECT * FROM pdf_barcode_documents WHERE pdf_id = ?`;
  const [rows] = await db.execute(query, [id]);
  return rows[0];
};

// New function to log PDF download events
const logPdfDownload = async (userId, pdfDocumentId) => {
  const query = `INSERT INTO pdf_download_logs (user_id, pdf_document_id, action) VALUES (?, ?, "download")`;
  const [result] = await db.execute(query, [userId, pdfDocumentId]);
  return result;
};

// model for getting all of the pdf files access logs
// const getPdfDownloadLogs = async () => {
//   const query = `
//    SELECT
//   o.first_name,
//   o.last_name,
//   u.email,
//   -- Prefer the file_name from the most recent uploaded document; if not available, use the template's file_name
//   COALESCE(upl.file_name, pdf.file_name) AS file_name,
//   upl.id AS filled_pdf_id,
//   upl.created_at,
//   org.organization_name,
//   org.organization_address,
//   log.id,
//   log.pdf_document_id,
//   log.download_time,
//   log.action
// FROM pdf_download_logs AS log
// JOIN pdf_barcode_documents AS pdf
//   ON log.pdf_document_id = pdf.pdf_id
// LEFT JOIN pdf_barcode_uploaded_documents AS upl
//   ON upl.id = (
//        SELECT u2.id
//        FROM pdf_barcode_uploaded_documents u2
//        WHERE u2.pdf_document_id = log.pdf_document_id
//        ORDER BY u2.created_at DESC
//        LIMIT 1
//      )
// JOIN user AS u
//   ON log.user_id = u.user_id
// JOIN organization AS o
//   ON u.user_id = o.user_id
// JOIN organization_details AS org
//   ON o.organization_detail_id = org.organization_detail_id
// ORDER BY log.download_time DESC;

//   `;
//   const [rows] = await db.execute(query);
//   // Decrypt the encrypted fields (assuming first_name and last_name are encrypted)
//   const decryptedRows = rows.map((row) => {
//     return {
//       ...row,
//       first_name: decrypt(row.first_name),
//       last_name: decrypt(row.last_name),
//     };
//   });
//   return decryptedRows;
// };

const getPdfDownloadLogs = async () => {
  const query = `
    SELECT 
      o.first_name,
      o.last_name,
      u.email,
      pdf.file_name AS file_name,
      log.filled_pdf_id,
      org.organization_name,
      org.organization_address,
      log.id,
      log.pdf_document_id,
      log.download_time,
      log.action
    FROM pdf_download_logs AS log
    JOIN pdf_barcode_documents AS pdf 
      ON log.pdf_document_id = pdf.pdf_id AND log.action = "download"
    JOIN user AS u 
      ON log.user_id = u.user_id
    JOIN organization AS o 
      ON u.user_id = o.user_id
    JOIN organization_details AS org 
      ON o.organization_detail_id = org.organization_detail_id
    ORDER BY log.download_time DESC;
  `;

  const [rows] = await db.execute(query);

  // Decrypt fields
  const decryptedRows = rows.map((row) => {
    return {
      ...row,
      first_name: decrypt(row.first_name),
      last_name: decrypt(row.last_name),
    };
  });

  return decryptedRows;
};

const getPdfUploadLogsWithSignatures = async () => {
  const query = `
    SELECT 
      o.first_name,
      o.last_name,
      u.email,
      upl.file_name,
      upl.file_path,
      upl.id AS filled_pdf_id,
      upl.created_at,
      org.organization_name,
      org.organization_address,
      crs.signwell_document_id,
      crs.recipient1_name,
      crs.recipient1_email,
      crs.recipient1_status,
      crs.recipient2_name,
      crs.recipient2_email,
      crs.recipient2_status,
      
      crs.recipient3_name,
      crs.recipient3_email,
      crs.recipient3_status,
      crs.recipient4_name,
      crs.recipient4_email,
      crs.recipient4_status,
      
      crs.updated_at as signatureupdateDate
      
    FROM pdf_barcode_uploaded_documents AS upl
    JOIN user AS u 
      ON upl.uploaded_by = u.user_id
    JOIN organization AS o 
      ON u.user_id = o.user_id
    JOIN organization_details AS org 
      ON o.organization_detail_id = org.organization_detail_id
    LEFT JOIN change_request_signatures AS crs 
      ON crs.change_request_document_id = upl.id
    ORDER BY upl.created_at DESC;
  `;

  const [rows] = await db.execute(query);

  const decryptedRows = rows.map((row) => ({
    ...row,
    first_name: decrypt(row.first_name),
    last_name: decrypt(row.last_name),
  }));

  return decryptedRows;
};

// create department for pdf
const createDepartment = async (departmentName, ownerUserId, assignedUsers) => {
  // Insert the new department
  const query = `INSERT INTO departments (department_name, user_id) VALUES (?, ?)`;
  const [result] = await db.execute(query, [departmentName, ownerUserId]);
  const departmentId = result.insertId;

  // Insert into the join table for each assigned user
  // Expect assignedUsers to be an array of user IDs
  const joinQuery = `INSERT INTO department_users (department_id, user_id) VALUES (?, ?)`;
  for (const userId of assignedUsers) {
    await db.execute(joinQuery, [departmentId, userId]);
  }
  return { departmentId };
};

// get all departments by user

const getDepartmentsByUser = async (userId) => {
  const query = `
    SELECT d.*
    FROM departments d
    JOIN department_users du ON d.department_id = du.department_id
    WHERE du.user_id = ?
  `;
  const [rows] = await db.execute(query, [userId]);
  return rows;
};

// Get all assigned users for a specific department
const getAssignedUsersByDepartment = async (departmentId) => {
  const query = `
    SELECT u.user_id, o.first_name, o.last_name, u.email
    FROM department_users du
    JOIN \`user\` u ON du.user_id = u.user_id
    JOIN organization o ON o.user_id = u.user_id
    WHERE du.department_id = ?
  `;
  const [rows] = await db.execute(query, [departmentId]);
  return rows;
};

// Update the assigned users for a department
const updateDepartmentUsers = async (departmentId, assignedUsers) => {
  // First, delete all current assignments for this department
  await db.execute(`DELETE FROM department_users WHERE department_id = ?`, [
    departmentId,
  ]);

  // Insert the new assignments one by one
  const joinQuery = `INSERT INTO department_users (department_id, user_id) VALUES (?, ?)`;
  for (const userId of assignedUsers) {
    await db.execute(joinQuery, [departmentId, userId]);
  }
  return { departmentId, assignedUsers };
};

// new code regarding chatting with pdf through ai
const savePdfTextForChat = async (userId, pdfText) => {
  try {
    console.log(`Saving PDF text for user ${userId}`);
    await db.execute("DELETE FROM pdf_chat_data WHERE user_id = ?", [userId]);

    // Ensure text is properly escaped/encoded
    const query = "INSERT INTO pdf_chat_data (user_id, pdf_text) VALUES (?, ?)";
    const [result] = await db.execute(query, [userId, pdfText]);
    console.log(`Saved PDF text for user ${userId}, result:`, result);
    return result;
  } catch (error) {
    console.error("Error saving PDF text:", error);
    throw error;
  }
};

const getPdfTextForChat = async (userId) => {
  try {
    console.log(`Retrieving PDF text for user ${userId}`);
    const query = "SELECT pdf_text FROM pdf_chat_data WHERE user_id = ?";
    const [rows] = await db.execute(query, [userId]);
    console.log(`Retrieved ${rows.length} rows for user ${userId}`);
    return rows[0]?.pdf_text || null;
  } catch (error) {
    console.error("Error retrieving PDF text:", error);
    throw error;
  }
};

const clearPdfTextForChat = async (userId) => {
  const query = "DELETE FROM pdf_chat_data WHERE user_id = ?";
  const [result] = await db.execute(query, [userId]);
  return result;
};
module.exports = {
  savePdfForm,
  createPdfDocument,
  getAllPdfDocuments,
  getPdfDocumentById,
  logPdfDownload,
  getPdfDownloadLogs,
  getPdfUploadLogsWithSignatures,
  createDepartment,
  getDepartmentsByUser,
  getAssignedUsersByDepartment,
  updateDepartmentUsers,
  savePdfTextForChat,
  getPdfTextForChat,
  clearPdfTextForChat,
  getFilledPdfDocumentById,
};
