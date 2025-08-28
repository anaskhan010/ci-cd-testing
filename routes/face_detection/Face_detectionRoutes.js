const express = require("express");
const multer = require("multer");
const path = require("path");
const face_detectionController = require("../../controllers/face_detection/Face_detectionController");
const router = express.Router();

// Configure Multer for file uploads
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/patients"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

var upload = multer({ storage: storage });
// Route to match organization image
router.post(
  "/verify_detection",
  upload.single("image"),
  face_detectionController.matchOrganizationImage
);

module.exports = router;
