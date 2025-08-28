const express = require("express");
const pdfBarController = require("../../controllers/pdfBarCode/pdfBarCodeController");
const upload = require("../../utils/multerConfig");

const { diskUpload, chatUpload } = require("../../utils/pdfChatMulterConfig");
const { PDFContentStream } = require("pdf-lib");
const filledUpload = require("../../utils/filledMulterConfig");

const router = express.Router();

// Existing endpoints
router.get("/pdf-download", pdfBarController.pdfFormGenerator);
router.post(
  "/create-pdf-document",
  upload.single("pdfFile"),
  pdfBarController.pdfDocumentCreator
);

// New endpoints:
// List all PDF documents (to let the frontend display available PDFs)
router.get("/pdf-documents", pdfBarController.getPdfDocuments);

// Download (and encode) a specific PDF document by passing its id (e.g., /download-pdf-document?id=1)
router.get("/download-pdf-document", pdfBarController.downloadPdfDocument);

// Preview the pdf file for barcode placement
router.get("/change-request-document", pdfBarController.previewPdfDocument);

// pdf download logs route
router.get("/pdf-download-logs", pdfBarController.getPdfDownloadLogs);

// pdf download logs route
router.get("/pdf-upload-logs", pdfBarController.getPdfUploadlogs);

// create department for pdf
router.post("/create-department", pdfBarController.createDepartment);

// get all user departments
router.get("/departments", pdfBarController.getUserDepartments);

// New endpoints for department user management:
router.get(
  "/department-users/:departmentId",
  pdfBarController.getDepartmentUsers
);
router.put(
  "/department-users/:departmentId",
  pdfBarController.updateDepartmentUsers
);

router.post(
  "/upload-filled-document",
  filledUpload.single("pdfFile"),
  pdfBarController.uploadFilledDocument
);

router.get(
  "/download-filled-pdf-document",
  pdfBarController.downloadFilledPdfDocument
);

router.post(
  "/upload-pdf-for-chat",
  chatUpload.single("file"), // Use memory storage for chat files
  pdfBarController.uploadPdfForAiChat
);

// Other routes should use diskUpload instead of upload
// For example:
router.post("/ask-pdf", pdfBarController.askPdfQuestions);
router.post(
  "/create-pdf-document",
  diskUpload.single("pdfFile"),
  pdfBarController.pdfDocumentCreator
);
router.delete("/clear-pdf-chat", pdfBarController.clearUserPdfChatData);

router.get(
  "/refresh-document-status/:documentId",
  pdfBarController.refreshDocumentStatus
);

module.exports = router;
