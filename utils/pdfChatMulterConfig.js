const multer = require("multer");
const path = require("path"); // For PDF chat feature, store in memory
const chatStorage = multer.memoryStorage();
const chatUpload = multer({ storage: chatStorage }); // For file uploads that need to be saved to disk
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/pdfForm/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});
const diskUpload = multer({ storage: diskStorage });
module.exports = { diskUpload, chatUpload };
