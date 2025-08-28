var express = require("express");
var medicineController = require("../../controllers/medication/medicineController.js");
const medicineCommentController = require("../../controllers/medication/medicineCommentsController.js");

var router = express.Router();

router.post("/createMedicine", medicineController.createMedicine);

router.post(
  "/submitMedicineRecord",

  medicineController.submitMedicineRecordController
);

router.get("/getAllMedication", medicineController.getAllMedication);
router.get(
  "/getAllMedicationForInvestigator/:id",
  medicineController.getAllMedicationForInvestigator
);
router.get("/getMedicationById/:id", medicineController.getMedicationById);
router.get(
  "/getMedicationByUserId/:id",
  medicineController.getMedicationByUserId
);

router.get(
  "/getmedicationrecord/:id",
  medicineController.getMedicationByUserIdforPortal
);
router.put(
  "/updateMedication/:medication_id",
  medicineController.updateMedication
);
router.delete("/deleteMedication/:id", medicineController.deleteMedication);

router.get(
  "/getmedicinequestion",
  medicineController.getMedicineQuestionAndOptions
);
router.post(
  "/submitmedicineresponses",
  medicineController.submitMedicineQuestionResponses
);

router.get(
  "/getMedicineRecordByUserId/:id",
  medicineController.getMedicineRecordByUserId
);

// Comments Routes
router.post(
  "/medicine_comment",
  medicineCommentController.createMedicineCommentController
);

router.put(
  "/disable-medicine-record/:id",
  medicineController.disableMedicineRecord
);

router.get(
  "/getMedicineComments/:record_id",
  medicineCommentController.getMedicineController
);

module.exports = router;
