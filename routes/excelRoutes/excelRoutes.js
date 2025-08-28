const express = require("express");

const router = express.Router();

const excelController = require("../../controllers/excelController/excelController");

router.get("/get-excel-sheet/:user_id", excelController.getTLFBMasterViewLink);

// Route to get the edit link for all sheets
router.get(
  "/get-excel-edit-link/:user_id",
  excelController.getTLFBMasterEditLink
);

module.exports = router;








// ----------------------------------------------------------------------
// const express = require("express");

// const router = express.Router();

// const excelController = require("../../controllers/excelController/excelController");

// router.get("/get-excel-sheet/:user_id", excelController.getTLFBMasterViewLink);

// module.exports = router;
