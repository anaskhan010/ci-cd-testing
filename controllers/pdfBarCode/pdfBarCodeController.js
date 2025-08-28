const pdfBarCodeModel = require("../../models/pdfBarCode/pdfBarCodeModel");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { PDFDocument } = require("pdf-lib");
const bwipjs = require("bwip-js");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const signwell = require("@api/signwell");
require("dotenv").config();
// Authenticate with SignWell using your API key from environment variables
signwell.auth(process.env.SIGNWELL_API_KEY);

const db = require("../../config/DBConnection3");

const pdfTexts = new Map();

const pdfFormGenerator = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userData = decoded.user_id;

    console.log(userData, "======token=====");

    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    const textToEncode = `${randomNumber}-${userData}`;
    const pngBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: textToEncode,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });

    const result = await pdfBarCodeModel.savePdfForm(userData);

    console.log(result, "=======pdf====");
    const existingPdfBytes = fs.readFileSync(
      "./public/pdfForm/change_request_form.pdf"
    );
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width } = firstPage.getSize();

    firstPage.drawImage(pngImage, {
      x: width - 200,
      y: 720,
      width: 130,
      height: 50,
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=modified.pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).send("Internal Server Error");
  }
};

const pdfDocumentCreator = async (req, res) => {
  try {
    // Ensure a file is provided
    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: "No file uploaded.",
        success: false,
      });
    }
    // Use provided fileName or fallback to original file name
    const fileName = req.body.fileName || req.file.originalname;
    const filePath = req.file.path;

    // Extract the departmentId from the request body
    const departmentId = req.body.departmentId;
    if (!departmentId) {
      return res.status(400).json({
        status: 400,
        message: "Department must be selected.",
        success: false,
      });
    }

    // Save fileName, filePath, and departmentId into the database
    await pdfBarCodeModel.createPdfDocument(fileName, filePath, departmentId);

    res.json({
      status: 200,
      message: "PDF Document created successfully",
      success: true,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: `Something went wrong while creating the PDF document: ${error.message}`,
      success: false,
    });
  }
};

// New endpoint: list all pdf documents for frontend display
const getPdfDocuments = async (req, res) => {
  const departmentId = req.query.departmentId;

  console.log("--------department id-----------");
  console.log(departmentId);

  try {
    const documents = await pdfBarCodeModel.getAllPdfDocuments(departmentId);
    res.json({
      status: 200,
      data: documents,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
      success: false,
    });
  }
};

// New endpoint: download a specific pdf document (by id) with barcode encoding
const downloadPdfDocument = async (req, res) => {
  try {
    const docId = req.query.id;

    const token = req.query.token;
    if (!docId) {
      return res.status(400).json({
        status: 400,
        message: "Missing document id",
        success: false,
      });
    }
    const document = await pdfBarCodeModel.getPdfDocumentById(docId);
    if (!document) {
      return res.status(404).json({
        status: 404,
        message: "Document not found",
        success: false,
      });
    }

    // Get user info from token to generate a barcode
    // const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userData = decoded.user_id;

    // Generate a random number and barcode text
    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    const textToEncode = `${randomNumber}-${userData}`;

    // Generate a barcode image using bwip-js
    const pngBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: textToEncode,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });

    // Read the PDF file from disk using the stored file path
    const pdfBytesOriginal = fs.readFileSync(document.file_path);
    const pdfDoc = await PDFDocument.load(pdfBytesOriginal);

    // Embed the barcode image in the PDF
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width } = firstPage.getSize();
    firstPage.drawImage(pngImage, {
      x: width - 200,
      y: 720,
      width: 130,
      height: 50,
    });

    const modifiedPdfBytes = await pdfDoc.save();

    // Set headers to prompt file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${document.file_name}`
    );
    res.send(Buffer.from(modifiedPdfBytes));
  } catch (error) {
    console.error("Error downloading PDF document:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

const previewPdfDocument = async (req, res) => {
  try {
    const docId = req.query.id;
    if (!docId) {
      return res.status(400).json({
        status: 400,
        message: "Missing document id",
        success: false,
      });
    }

    // Optional coordinates and barcode style parameters
    const xCoord = req.query.x ? parseFloat(req.query.x) : null;
    const yCoord = req.query.y ? parseFloat(req.query.y) : null;
    const scale = req.query.scale ? parseFloat(req.query.scale) : 3;
    const barcodeHeight = req.query.height ? parseFloat(req.query.height) : 10;
    const includeText = req.query.includetext === "false" ? false : true;
    const textxalign = req.query.textxalign || "center";

    // Retrieve PDF document record
    const document = await pdfBarCodeModel.getPdfDocumentById(docId);
    if (!document) {
      return res.status(404).json({
        status: 404,
        message: "Document not found",
        success: false,
      });
    }

    // Retrieve token (from header or query) and decode it
    let token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) token = req.query.token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided." });
    }
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;

    // Generate barcode image using bwip-js
    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    const textToEncode = `${randomNumber}-${userId}`;
    const pngBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: textToEncode,
      scale: scale,
      height: barcodeHeight,
      includetext: includeText,
      textxalign: textxalign,
    });

    // Load PDF, embed the barcode image, and adjust placement
    const pdfBytesOriginal = fs.readFileSync(document.file_path);
    const pdfDoc = await PDFDocument.load(pdfBytesOriginal);
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width } = firstPage.getSize();
    const x = xCoord !== null ? xCoord : width - 200;
    const y = yCoord !== null ? yCoord : 720;
    firstPage.drawImage(pngImage, {
      x: x,
      y: y,
      width: 130,
      height: 50,
    });

    const modifiedPdfBytes = await pdfDoc.save();

    // If this is a download request, log the download event
    if (req.query.download === "true") {
      await pdfBarCodeModel.logPdfDownload(userId, docId);
    }

    res.setHeader("Content-Type", "application/pdf");
    // If download=true then force file download; otherwise, display inline
    const disposition = req.query.download === "true" ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=${document.file_name}`
    );
    res.send(Buffer.from(modifiedPdfBytes));
  } catch (error) {
    console.error("Error in previewPdfDocument:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

// pdf download logs controller function
const getPdfDownloadLogs = async (req, res) => {
  try {
    const logs = await pdfBarCodeModel.getPdfDownloadLogs();
    res.json({
      status: 200,
      data: logs,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching PDF download logs:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

const getPdfUploadlogs = async (req, res) => {
  try {
    const logs = await pdfBarCodeModel.getPdfUploadLogsWithSignatures();
    res.json({
      status: 200,
      data: logs,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching PDF download logs:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

// create departments for pdf file
const createDepartment = async (req, res) => {
  try {
    // Get token and decode to obtain the owner’s user_id
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const ownerUserId = decoded.user_id;

    const { departmentName, assignedUsers } = req.body;
    if (!departmentName) {
      return res.status(400).json({ message: "Department name is required" });
    }

    // If no assignedUsers are provided, default to the owner only.
    const usersToAssign =
      Array.isArray(assignedUsers) && assignedUsers.length > 0
        ? assignedUsers
        : [ownerUserId];

    const result = await pdfBarCodeModel.createDepartment(
      departmentName,
      ownerUserId,
      usersToAssign
    );

    res.json({
      status: 200,
      message: "Department created successfully",
      departmentId: result.departmentId,
      success: true,
    });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

// get user departments
const getUserDepartments = async (req, res) => {
  try {
    // Decode token to get current user id
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;

    const departments = await pdfBarCodeModel.getDepartmentsByUser(userId);
    res.json({
      status: 200,
      data: departments,
      success: true,
      userId: userId,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

// Get assigned users for a given department
const getDepartmentUsers = async (req, res) => {
  const departmentId = req.params.departmentId;
  if (!departmentId) {
    return res.status(400).json({ message: "Department id is required" });
  }
  try {
    const users = await pdfBarCodeModel.getAssignedUsersByDepartment(
      departmentId
    );
    res.status(200).json({ status: 200, data: users, success: true });
  } catch (error) {
    res
      .status(500)
      .json({ status: 500, message: error.message, success: false });
  }
};

// Update assigned users for a given department
const updateDepartmentUsers = async (req, res) => {
  const departmentId = req.params.departmentId;
  const { assignedUsers } = req.body; // expected to be an array of user IDs
  if (!departmentId || !Array.isArray(assignedUsers)) {
    return res.status(400).json({
      message: "Department id and an array of assignedUsers are required",
    });
  }
  try {
    const result = await pdfBarCodeModel.updateDepartmentUsers(
      departmentId,
      assignedUsers
    );
    res.status(200).json({
      status: 200,
      message: "Department users updated successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: 500, message: error.message, success: false });
  }
};

const uploadFilledDocument = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded." });

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;

    const fileNameInitial = req.body.fileName || req.file.originalname;
    const filePath = req.file.path;
    const pdfDocumentId = req.body.pdfDocumentId;

    if (!pdfDocumentId) {
      return res.status(400).json({ message: "PDF Document ID is required." });
    }

    await db.execute(
      `INSERT INTO pdf_download_logs (user_id, pdf_document_id, action, file_name) VALUES (?, ?, 'upload', ?)`,
      [userId, pdfDocumentId, fileNameInitial]
    );

    // Insert and capture insertId
    const [uploadResult] = await db.execute(
      `INSERT INTO pdf_barcode_uploaded_documents (file_name, file_path, pdf_document_id, uploaded_by) VALUES (?, ?, ?, ?)`,
      [fileNameInitial, filePath, pdfDocumentId, userId]
    );

    const uploadedDocId = uploadResult.insertId;

    let { recipients } = req.body;
    if (typeof recipients === "string") {
      recipients = JSON.parse(recipients);
    }

    if (!recipients || recipients.length !== 4) {
      return res
        .status(400)
        .json({ message: "Exactly 4 recipients are required." });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileBase64 = fileBuffer.toString("base64");
    const fileName = req.body.fileName || req.file.originalname;

    const signwellRecipients = recipients.map((recipient, index) => ({
      id: `${index + 1}`,
      name: recipient.username,
      email: recipient.email,
      send_email: true,
      send_email_delay: 0,
    }));

    const pageWidth = 612;
    const leftX = 280;
    const rightX = pageWidth - 60;
    const topY = 650;
    const bottomY = topY + 50;

    const fields = [
      {
        x: leftX,
        y: topY,
        page: 1,
        recipient_id: "1",
        type: "signature",
        required: true,
        api_id: "signature_1",
      },
      {
        x: rightX,
        y: topY,
        page: 1,
        recipient_id: "2",
        type: "signature",
        required: true,
        api_id: "signature_2",
      },
      {
        x: leftX,
        y: bottomY,
        page: 1,
        recipient_id: "3",
        type: "signature",
        required: true,
        api_id: "signature_3",
      },
      {
        x: rightX,
        y: bottomY,
        page: 1,
        recipient_id: "4",
        type: "signature",
        required: true,
        api_id: "signature_4",
      },
    ];

    const payload = {
      test_mode: true,
      draft: false,
      embedded_signing: true,
      name: "Document for Signing",
      subject: "Please sign this document",
      message: "This document requires your signature",
      recipients: signwellRecipients,
      fields: [fields],
      files: [{ name: fileName, file_base64: fileBase64 }],
    };

    const response = await signwell.postApiV1Documents(payload);
    const documentData = response.data;
    const embeddedUrls = documentData.embedded_signing_urls || [];

    const insertQuery = `
 INSERT INTO change_request_signatures (
 user_id, file_path, change_request_document_id, signwell_document_id,
 recipient1_name, recipient1_email, recipient1_status, recipient1_bounced, embedded_signing_url_recipient1,
 recipient2_name, recipient2_email, recipient2_status, recipient2_bounced, embedded_signing_url_recipient2,
 recipient3_name, recipient3_email, recipient3_status, recipient3_bounced, embedded_signing_url_recipient3,
 recipient4_name, recipient4_email, recipient4_status, recipient4_bounced, embedded_signing_url_recipient4 
 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)
 `;

    const values = [
      userId,
      filePath,
      uploadedDocId,
      documentData.id,

      recipients[0].username,
      recipients[0].email,
      "sent",
      false,
      embeddedUrls[0]?.url || null,

      recipients[1].username, // <--- was missing
      recipients[1].email,
      "sent",
      false,
      embeddedUrls[1]?.url || null,

      recipients[2].username, // <--- was missing
      recipients[2].email,
      "sent",
      false,
      embeddedUrls[2]?.url || null,

      recipients[3].username, // <--- was missing
      recipients[3].email,
      "sent",
      false,
      embeddedUrls[3]?.url || null,
    ];

    await db.execute(insertQuery, values);

    // 🔁 Update previously inserted pdf_barcode_uploaded_documents with document_id from SignWell
    await db.execute(
      `UPDATE pdf_barcode_uploaded_documents SET signwell_document_id = ? WHERE id = ?`,
      [documentData.id, uploadedDocId]
    );

    res.json({ message: "Document sent for signature", data: documentData });
  } catch (error) {
    console.error("Error sending document for signature:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", details: error.message });
  }
};

const uploadPdfForAiChat = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;

    const data = await pdfParse(req.file.buffer);
    console.log(
      `PDF parsed successfully for user ${userId}. Text length: ${data.text.length}`
    );

    // Store in database
    await pdfBarCodeModel.savePdfTextForChat(userId, data.text);
    console.log(`PDF text stored in database for user ${userId}`);

    // Verify storage by immediately retrieving
    const storedText = await pdfBarCodeModel.getPdfTextForChat(userId);
    console.log(
      `Retrieved text length after storage: ${storedText?.length || 0}`
    );

    res.json({ message: "PDF uploaded and processed" });
  } catch (err) {
    console.error("PDF processing error:", err);
    res.status(500).json({ error: "Error processing PDF" });
  }
};

const askPdfQuestions = async (req, res) => {
  const { question } = req.body;
  console.log(`Received question: ${question}`);

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;
    console.log(`User ID: ${userId}`);

    const pdfText = await pdfBarCodeModel.getPdfTextForChat(userId);
    console.log(`Retrieved PDF text length: ${pdfText?.length || 0}`);

    if (!pdfText) {
      console.log("No PDF text found for user");
      return res.status(400).json({ error: "No PDF uploaded yet" });
    }

    console.log("Sending request to AI...");
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1:free",
        messages: [
          {
            role: "system",
            content:
              "You are an AI that answers questions based on a provided PDF document.",
          },
          {
            role: "user",
            content: `Document: ${pdfText}\n\nQuestion: ${question}`,
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer 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`,
        },
      }
    );

    const answer = response.data.choices[0].message.content;
    console.log("Received answer:", answer);
    res.json({ answer });
  } catch (err) {
    console.error("AI request error:", err);
    res.status(500).json({ error: "AI request failed", details: err.message });
  }
};

const clearUserPdfChatData = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;

    await pdfBarCodeModel.clearPdfTextForChat(userId);
    res.json({ message: "PDF chat data cleared" });
  } catch (err) {
    console.error("Error clearing PDF chat data:", err);
    res.status(500).json({ error: "Error clearing data" });
  }
};

const downloadFilledPdfDocument = async (req, res) => {
  try {
    const docId = req.query.id;

    console.log("Uploaded document id here: ");
    if (!docId) {
      return res.status(400).json({
        status: 400,
        message: "Missing filled document id",
        success: false,
      });
    }
    // Fetch filled document record from the separate table
    const document = await pdfBarCodeModel.getFilledPdfDocumentById(docId);
    if (!document) {
      return res.status(404).json({
        status: 404,
        message: "Filled document not found",
        success: false,
      });
    }

    // Debug log to check the file path being used
    console.log("Downloading filled document from:", document.file_path);

    // Get token from header or query parameter
    let token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) token = req.query.token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided." });
    }
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userData = decoded.user_id;

    // Generate barcode image
    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    const textToEncode = `${randomNumber}-${userData}`;
    const pngBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: textToEncode,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });

    // Read the filled PDF file using its file_path
    const pdfBytesOriginal = fs.readFileSync(document.file_path);
    const pdfDoc = await PDFDocument.load(pdfBytesOriginal);
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width } = firstPage.getSize();
    firstPage.drawImage(pngImage, {
      x: width - 200000,
      y: 72000,
      width: 0,
      height: 0,
    });
    const modifiedPdfBytes = await pdfDoc.save();

    // Set response headers and send the filled PDF file
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${document.file_name}`
    );
    res.send(Buffer.from(modifiedPdfBytes));
  } catch (error) {
    console.error("Error downloading filled PDF document:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

const refreshDocumentStatus = async (req, res) => {
  const { documentId } = req.params;

  try {
    // Get the latest document data from SignWell
    const { data } = await signwell.getApiV1DocumentsId({ id: documentId });
    const recipients = data.recipients;

    // Map recipient IDs to their info
    const recipientMap = {};
    recipients.forEach((r) => {
      recipientMap[r.id] = {
        status: r.status || null,
        bounced: r.bounced || false,
      };
    });

    // Get current data from your database
    const [existing] = await db.query(
      `SELECT 
 recipient1_status, recipient1_bounced,
 recipient2_status, recipient2_bounced,
 recipient3_status, recipient3_bounced,
 recipient4_status, recipient4_bounced
 FROM change_request_signatures
 WHERE signwell_document_id = ? LIMIT 1`,
      [documentId]
    );

    if (!existing.length) {
      return res
        .status(404)
        .json({ message: "Document not found in database." });
    }

    const current = existing[0];
    const updatedFields = {};
    let hasUpdates = false;

    for (let i = 1; i <= 4; i++) {
      const rec = recipientMap[i.toString()];
      if (!rec) continue;

      if (current[`recipient${i}_status`] !== rec.status) {
        updatedFields[`recipient${i}_status`] = rec.status;
        hasUpdates = true;
      }

      if (current[`recipient${i}_bounced`] !== String(rec.bounced)) {
        updatedFields[`recipient${i}_bounced`] = rec.bounced;
        hasUpdates = true;
      }
    }

    // Only update if something changed
    if (hasUpdates) {
      const setClause = Object.keys(updatedFields)
        .map((field) => `${field} = ?`)
        .join(", ");

      const values = Object.values(updatedFields);
      values.push(documentId); // For WHERE clause

      const updateQuery = `
 UPDATE change_request_signatures
 SET ${setClause}
 WHERE signwell_document_id = ?
 `;

      await db.query(updateQuery, values);
    }

    res.status(200).json({
      message: hasUpdates
        ? "Document status updated successfully"
        : "No updates found; status is already up to date.",
      updated: hasUpdates,
      data: updatedFields,
    });
  } catch (error) {
    console.error("Error refreshing document status:", error);
    res.status(500).json({
      error: "Error refreshing document status",
      details: error.message,
    });
  }
};

module.exports = {
  pdfFormGenerator,
  pdfDocumentCreator,
  getPdfDocuments,
  downloadPdfDocument,
  previewPdfDocument,
  getPdfDownloadLogs,
  getPdfUploadlogs,
  createDepartment,
  getUserDepartments,
  getDepartmentUsers,
  updateDepartmentUsers,
  uploadFilledDocument,
  uploadPdfForAiChat,
  askPdfQuestions,
  clearUserPdfChatData,
  downloadFilledPdfDocument,
  refreshDocumentStatus,
};
