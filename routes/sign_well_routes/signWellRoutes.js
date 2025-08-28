// routes/signWellRoutes.js

// routes/signWellRoutes.js

const express = require("express");
const {
  upload,
  createDocumentForSigning,
  getSignedDocs,
  getDbDocsByUserId,
  refreshDocumentStatus,
  getCompletedDoucments,
  archivalScale,
  updateDocumentForSigning
} = require("../../controllers/sign_well_controller/signWellController");

const router = express.Router();

router.post("/upload-pdf", upload.single("pdf"), createDocumentForSigning);
router.get("/getdocumentsbyid/:documentId", getSignedDocs);

router.get("/getdocumentrecord/:user_id", getDbDocsByUserId);
router.get("/refresh-status/:documentId", refreshDocumentStatus);
router.get("/getsignedpdf/:doc_id", getCompletedDoucments);

router.put("/disable_scale/:id", archivalScale);
router.put("/change-uploaded-pdf",  updateDocumentForSigning);

module.exports = router;
