// multerConfig.js
const multer = require("multer");
const path = require("path");

// Configure storage options for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define the destination folder for uploads
    cb(null, "./public/pdfForm/");
  },
  filename: (req, file, cb) => {
    // Create a unique filename using the current timestamp and a random number,
    // and append the original file extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    console.log("----------INSIDE MULTER MIDDLEWARE FUNCTION-------------");
    // Log file info for debugging if needed:
    // console.log(file);
    cb(null, uniqueSuffix + ext);
  },
});

// Initialize multer with the storage configuration
const upload = multer({ storage: storage });

module.exports = upload;
