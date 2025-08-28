const express = require("express");
const personelSubjectController = require("../../controllers/PersonelSubjects/PersonalSubjectController");

const router = express.Router();

router.post(
  "/create_personel_subject",
  personelSubjectController.createPersonelSubjectController
);

router.get("/get-all-personnels", personelSubjectController.getAllPersonel);
router.get("/get-subjects", personelSubjectController.getSubjects);

router.get(
  "/get-assigned-subjects/:personnel_id",
  personelSubjectController.getAssignedSubjectsByPersonnelIdController
);

router.put(
  "/update-assigned-subjects",
  personelSubjectController.updateAssignedSubjectsController
);

module.exports = router;
