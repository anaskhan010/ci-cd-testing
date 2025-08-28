var express = require("express");
var scheduleController = require("../../controllers/schedules/scheduleController.js");
const auditLog = require("../../middleware/audit_logger");
var router = express.Router();

router.post(
  "/createSchedule",
  auditLog("create", "schedule"),
  scheduleController.createSchedule
);

router.post(
  "/create_manual_schedule",
  auditLog("create", "Manual schedule"),
  scheduleController.createManualSchedule
);

router.get("/get-day-name/:id", scheduleController.getDayNameByStudy);

router.get("/getAllSchedules", scheduleController.getAllSchedules);

router.get(
  "/getAllSchedulesForInvestigator/:id",
  scheduleController.getAllSchedulesForInvestigator
);
router.get("/getScheduleById/:id", scheduleController.getScheduleById);
router.put(
  "/updateSchedule/:id",
  auditLog("update", "schedule"),
  scheduleController.updateSchedule
);
router.delete(
  "/deleteSchedule/:id",
  auditLog("delete", "schedule"),
  scheduleController.deleteSchedule
);
router.get("/schedulesbyuserid/:id", scheduleController.getSchedulesbyUserid);
router.get(
  "/getAllFutureSchedulesForUser/:id",
  scheduleController.getAllFutureSchedulesForUser
);
router.get(
  "/patient-schedules/:userId/:language_code",
  scheduleController.scheduleScaleController.getFullSchedule
);

router.get(
  "/spa-patient-schedules/:userId",
  scheduleController.SpanishscheduleScaleController.getFullSchedule
);

router.get(
  "/rom-patient-schedules/:userId",
  scheduleController.RomanionScheduleScaleController.getFullSchedule
);

router.get(
  "/fetch_all_schedules_by_user_id/:id",
  scheduleController.getScheduleByUSERIDController
);

router.get(
  "/fetch-for-each-user-first-record",
  scheduleController.getAllScheduleFirstRecordForEachUserController
);

module.exports = router;
