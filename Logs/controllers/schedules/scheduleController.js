const { body, param, validationResult } = require("express-validator");
const scheduleModel = require("../../models/schedules/scheduleModel.js");
const organizationModel = require("../../models/organization/organizationModel.js");
const ScheduleEmail = require("../../middleware/ScheduleEmail.js");

const {
  scheduleScaleModel,
  SpanishscheduleScaleModel,
  RomanionScheduleScaleModel,
} = require("../../models/schedules/scheduleModel.js");

const auditLog = require("../../middleware/audit_logger.js");
const jwt = require("jsonwebtoken");

// Validation rules for creating a schedule
const validateCreateSchedule = [
  body("schedule_date")
    .notEmpty()
    .withMessage("Schedule date is required")
    .isISO8601()
    .withMessage("Schedule date must be a valid date"),
  body("schedule_time").notEmpty().withMessage("Schedule time is required"),
  body("study_enrolled_id")
    .notEmpty()
    .withMessage("Study enrolled ID is required"),
  body("status").notEmpty().withMessage("Status is required"),
  body("note").optional().isString().withMessage("Note must be a string"),
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required")
    .isInt()
    .withMessage("User ID must be an integer"),
];

// Validation rules for updating a schedule
const validateUpdateSchedule = [
  param("id").isInt().withMessage("Schedule ID must be an integer"),
  body("schedule_date")
    .optional()
    .isISO8601()
    .withMessage("Schedule date must be a valid date"),
  body("schedule_time")
    .optional()
    .isString()
    .withMessage("Schedule time must be a string"),
  body("status").optional().isString().withMessage("Status must be a string"),
  body("note").optional().isString().withMessage("Note must be a string"),
  body("user_id").optional().isInt().withMessage("User ID must be an integer"),
];

// Validation rules for getting and deleting a schedule by ID
const validateScheduleId = [
  param("id").isInt().withMessage("Schedule ID must be an integer"),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createSchedule = async (req, res) => {
  const {
    schedule_date,
    schedule_time,
    study_enrolled_id,
    status,
    note,
    user_id,
  } = req.body;

  console.log(
    "---------------------data from schedule controller -----------------------------"
  );

  try {
    const result = await scheduleModel.createPatientSchedule(
      schedule_date,
      schedule_time,
      study_enrolled_id,
      status,
      note,
      user_id
    );

    const newData = {
      schedule_date: result.schedule_date,
      schedule_time: result.schedule_time,
      study_enrolled_id: result.study_enrolled_id,
      status: result.status,
      note: result.note,
      user_id: result.user_id,
    };

    auditLog(
      "CREATE",
      "Schedule",
      null,
      newData,
      `Schedule created successfully for user ${user_id}`
    )(req, res, () => {});

    const user = await scheduleModel.getOrganizationById(user_id);
    const { first_name, last_name, email } = user;
    const emailSubject = `New Patient Appointment Scheduled`;

    try {
      const emailResponse = await ScheduleEmail(
        email,
        emailSubject,
        first_name,
        last_name
      );
      console.log("Email sent response:", emailResponse);
    } catch (emailError) {
      console.log("Email sending failed controller 1:", emailError.message);
      return res.status(500).json({
        status: false,
        message: "Email sending failed controller 2",
        error: emailError.message,
      });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Error creating schedule:", err);
    res
      .status(500)
      .json({ error: "An error occurred while creating the schedule" });
  }
};

const createManualSchedule = async (req, res) => {
  const {
    schedule_date,
    schedule_time,
    study_enrolled_id,
    status,
    day_id,
    note,
    user_id,
  } = req.body;

  console.log(schedule_date, "check date controller");

  try {
    const result = await scheduleModel.createManualSchedule(
      schedule_date,
      schedule_time,
      study_enrolled_id,
      status,
      day_id,
      note,
      user_id
    );

    console.log(result, "======manual schedule=======");

    const newData = {
      schedule_date,
      schedule_time,
      study_enrolled_id,
      status,
      day_id,
      note,
      user_id,
    };

    auditLog(
      "CREATE",
      "Manual Schedule",
      null,
      newData,
      `Schedule Created successfully for user: ${user_id}`
    )(req, res, () => {});

    const user = await scheduleModel.getOrganizationById(user_id);
    const { first_name, last_name, email } = user;
    const emailSubject = `Appointment Scheduled`;

    try {
      const emailResponse = await ScheduleEmail(
        email,
        emailSubject,
        first_name,
        last_name,
        schedule_date,
        schedule_time
      );
      console.log("Email sent response:", emailResponse);
    } catch (emailError) {
      console.log("Email sending failed controller 1:", emailError.message);
      return res.status(500).json({
        status: false,
        message: "Email sending failed controller 2",
        error: emailError.message,
      });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Error creating schedule:", err);
    res
      .status(500)
      .json({ error: "An error occurred while creating the schedule" });
  }
};

const getDayNameByStudy = async (req, res) => {
  const studyEnrolledId = req.params.id;
  try {
    const result = await scheduleModel.getDayNameByStudyId(studyEnrolledId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getDayNameByStudy:", error);
    res.status(500).json({ error: error.message });
  }
};

const scheduleScaleController = {
  getFullSchedule: async (req, res) => {
    const { language_code } = req.params;

    console.log(language_code, "check code ");
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
      const roleId = decoded.role;
      console.log("Role ID:", roleId);
      const userId = req.params.userId;
      console.log("User ID:", userId);

      // Update accessibility before fetching schedules
      await scheduleScaleModel.updateAccessibilityForUser(userId);

      // Check if the user has any schedules
      const userSchedules = await scheduleScaleModel.getSchedules(userId);
      if (userSchedules.length === 0) {
        return res.status(200).json([]);
      }

      const fullSchedule = await Promise.all(
        userSchedules.map(async (schedule) => {
          const scalesForDay = await scheduleScaleModel.getScalesForDay(
            schedule.schedule_id,
            userId,
            roleId,
            language_code
          );
          return scalesForDay[0]; // Since getScalesForDay now returns an array with one item
        })
      );
      res.json(fullSchedule);
    } catch (error) {
      console.error("Error in getFullSchedule:", error);
      if (error.message === "No schedules found for this user") {
        res.status(404).json({ error: "No schedules found for this user" });
      } else {
        res
          .status(500)
          .json({ error: "An error occurred while fetching the schedule" });
      }
    }
  },
};

// Get all schedules

// const getAllSchedules = async (req, res) => {
//   try {
//     const token = req.headers.authorization.split(" ")[1];

//     // Decode the token
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     console.log("decoded", decoded);

//     const userId = decoded.user_id; // Ensure your token includes user_id
//     const roleId = decoded.role; // Ensure your token includes role_id

//     if (!userId || !roleId) {
//       return res.status(400).json({ error: "Invalid token payload" });
//     }

//     const result = await scheduleModel.getAllSchedules(userId, roleId);
//     res.status(200).json({ schedules: result });
//   } catch (error) {
//     console.error("Error in getAllSchedules:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

const getAllSchedules = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const personelId = decoded.user_id;

    if (!personelId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }
    const result = await scheduleModel.getAllSchedules(personelId);
    res.status(200).json({ schedules: result });
  } catch (error) {
    console.error("Error in getAllSchedules:", error);
    res.status(500).json({ error: error.message });
  }
};

const getAllScheduleFirstRecordForEachUserController = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id

    if (!userId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result = await scheduleModel.getAllSchedulesFirstRecordForEachUser(
      userId
    );
    res.status(200).json({ schedules: result });
  } catch (error) {
    console.error("Error in getAllSchedules:", error);
    res.status(500).json({ error: error.message });
  }
};

// get all schedules for an investigator
const getAllSchedulesForInvestigator = (req, res) => {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  scheduleModel
    .getAllSchedulesForInvestigator(investigatorId)
    .then((result) => res.status(200).json({ schedules: result }))
    .catch((error) => res.status(500).json({ error: error.message }));
};

// get all future schedules for a specific user
const getAllFutureSchedulesForUser = (req, res) => {
  const userId = req.params.id; // Assuming the user_id is passed as a route parameter

  scheduleModel
    .getAllFutureSchedulesForUser(userId)
    .then((result) => res.status(200).json({ schedules: result }))
    .catch((error) => res.status(500).json({ error: error.message }));
};
// Get schedule by ID
const getScheduleById = (req, res) => {
  const schedule_id = req.params.id;
  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const userId = decoded.user_id;

  scheduleModel
    .getScheduleById(schedule_id, userId)
    .then((result) => res.status(200).json({ schedule: result }))
    .catch((error) => res.status(500).json({ error: error.message }));
};

const updateSchedule = async (req, res) => {
  const schedule_id = req.params.id;
  const {
    study_enrolled_id,
    schedule_date,
    schedule_time,
    status,
    note,
    user_id,
    reason,
  } = req.body;

  console.log(req.body, "controller............");

  // Input Validation
  if (!schedule_id || !status || !user_id) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const oldSchedule = await scheduleModel.getScheduleByIdForUpdate(
      schedule_id
    );

    if (!oldSchedule) {
      return res.status(404).json({ message: "Schedule not found." });
    }

    // Check if the schedule is already in Completed status
    if (oldSchedule.status === "Completed") {
      return res.status(400).json({
        message:
          "Cannot modify a completed schedule. Completed schedules are locked for editing.",
      });
    }

    // If trying to change from any status to Cancelled and the schedule is already Completed
    if (status === "Cancelled" && oldSchedule.status === "Completed") {
      return res.status(400).json({
        message:
          "Cannot cancel a completed schedule. Completed schedules are locked for editing.",
      });
    }

    // Check if the schedule is already in Cancelled status and trying to change to something else
    if (oldSchedule.status === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({
        message:
          "Cannot change a cancelled schedule to another status. Cancelled schedules cannot be reverted.",
      });
    }

    let rescheduledData = null;
    if (status === "Rescheduled") {
      const { rescheduled, ...scheduleData } = oldSchedule;
      rescheduledData = scheduleData;
    }

    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const investigator_id = decoded.user_id;
    const result = await scheduleModel.updateSchedule({
      schedule_id,
      study_enrolled_id: study_enrolled_id || oldSchedule.study_enrolled_id,
      schedule_date,
      schedule_time,
      status,
      note,
      user_id,
      investigator_id,
      rescheduledData,
      reason,
      auditLogHandler: async (logData) => {
        await auditLog(
          logData.action,
          logData.entity,
          logData.oldValue,
          logData.newValue,
          logData.description
        )(req, res, () => {});
      },
    });

    // Audit Logging
    const oldValue = {
      schedule_date: oldSchedule.schedule_date,
      schedule_time: oldSchedule.schedule_time,
      status: oldSchedule.status,
      note: oldSchedule.note,

      user_id: oldSchedule.user_id,
    };

    const newValue = {
      schedule_date,
      schedule_time,
      status,
      note,
      user_id,
    };

    // Create objects to capture only the changed fields.
    const changedFieldsOld = {};
    const changedFieldsNew = {};

    for (const key in newValue) {
      // Compare using strict equality. For arrays, you may need a deeper comparison.
      if (oldValue[key] !== newValue[key]) {
        changedFieldsOld[key] = oldValue[key];
        changedFieldsNew[key] = newValue[key];
      }
    }
    changedFieldsOld.user_id = user_id;
    changedFieldsOld.schedule_id = schedule_id;
    changedFieldsNew.user_id = user_id;
    changedFieldsNew.schedule_id = schedule_id;
    if (status === "Rescheduled") {
      // Log cancellation of the old schedule
      await auditLog(
        "UPDATE",
        "schedule",
        { status: oldSchedule.status },
        { status: "Cancelled" },
        `Schedule with ID: ${schedule_id} cancelled due to rescheduling`
      )(req, res, () => {});

      // Log creation of the new schedule
      await auditLog(
        "UPDATE",
        "schedule",
        changedFieldsOld, // Only the old values that changed
        changedFieldsNew, // Only the new values that changed
        `New rescheduled schedule created with ID: ${result.newScheduleId}`
      )(req, res, () => {});
    } else {
      // Log the update
      await auditLog(
        "UPDATE",
        "schedule",
        changedFieldsOld, // Only the old values that changed
        changedFieldsNew, // Only the new values that changed
        `Schedule ${status.toLowerCase()} with ID: ${schedule_id}`
      )(req, res, () => {});
    }

    res.status(200).json({
      message:
        status === "Rescheduled"
          ? "Schedule rescheduled successfully."
          : status === "Completed"
          ? "Schedule marked as completed."
          : status === "Cancelled"
          ? "Schedule cancelled successfully."
          : "Schedule updated successfully.",
      schedule: result,
    });
  } catch (error) {
    console.error("Update Schedule Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete schedule

const deleteSchedule = async (req, res) => {
  const schedule_id = req.params.id;
  const { reason, user_id } = req.body;

  try {
    // Fetch the old schedule data before deleting
    const oldSchedule = await scheduleModel.getScheduleByIdForDelete(
      schedule_id
    );

    if (!oldSchedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

    const investigator_id = decoded.user_id;

    // Proceed with the deletion
    await scheduleModel.deleteSchedule(
      schedule_id,
      investigator_id,
      reason,
      user_id
    );

    auditLog(
      "DELETE",
      "schedule",
      oldSchedule,
      null,
      reason
    )(req, res, () => {});

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//GET aLl schedule by user id
const getSchedulesbyUserid = async (req, res) => {
  const user_id = req.params.id;

  try {
    const schedules = await scheduleModel.getAllSchedulesByUserId(user_id);
    if (schedules.length > 0) {
      res.status(200).json({
        status: true,
        data: schedules,
      });
    } else {
      res.status(404).json({
        status: false,
        message: "No schedules found for the given user",
      });
    }
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
const SpanishscheduleScaleController = {
  getFullSchedule: async (req, res) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
      const roleId = decoded.role;
      console.log("Role ID:", roleId);
      const userId = req.params.userId;
      console.log("User ID:", userId);

      const schedules = await SpanishscheduleScaleModel.getSchedules();
      const fullSchedule = await Promise.all(
        schedules.map(async (schedule) => {
          const scalesForDay = await SpanishscheduleScaleModel.getScalesForDay(
            schedule.schedule_id,
            userId,
            roleId
          );
          return scalesForDay;
        })
      );
      res.json(fullSchedule);
    } catch (error) {
      console.error("Error in getFullSchedule:", error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching the schedule" });
    }
  },
};
const RomanionScheduleScaleController = {
  getFullSchedule: async (req, res) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
      const roleId = decoded.role;
      console.log("Role ID:", roleId);
      const userId = req.params.userId;
      console.log("User ID:", userId);

      const schedules = await RomanionScheduleScaleModel.getSchedules();
      const fullSchedule = await Promise.all(
        schedules.map(async (schedule) => {
          const days = await RomanionScheduleScaleModel.getDaysForSchedule(
            schedule.schedule_id
          );
          const daysWithScales = await Promise.all(
            days.map(async (day) => {
              const scales = await RomanionScheduleScaleModel.getScalesForDay(
                day.day_id,
                userId,
                roleId
              );

              console.log(`Scales for day ${day.day_id}:`, scales);
              return { ...day, scales: scales || [] };
            })
          );
          return { ...schedule, days: daysWithScales };
        })
      );
      res.json(fullSchedule);
    } catch (error) {
      console.error("Error in getFullSchedule:", error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching the schedule" });
    }
  },
};

const getScheduleByUSERIDController = async (req, res) => {
  const schedule_id = req.params.id;

  if (!schedule_id) {
    return res.status(400).json({ error: "Schedule ID is required" });
  }

  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const personelId = decoded.user_id;

  scheduleModel
    .getScheduleByUSERId(schedule_id, personelId)
    .then((result) => res.status(200).json({ schedule: result }))
    .catch((error) => res.status(500).json({ error: error.message }));
};

module.exports = {
  createSchedule: [
    validateCreateSchedule,
    handleValidationErrors,
    createSchedule,
  ],
  createManualSchedule,
  getDayNameByStudy,
  getAllSchedules,
  getAllSchedulesForInvestigator,
  getScheduleById: [
    validateScheduleId,
    handleValidationErrors,
    getScheduleById,
  ],
  updateSchedule: [
    validateUpdateSchedule,
    handleValidationErrors,
    updateSchedule,
  ],
  deleteSchedule: [validateScheduleId, handleValidationErrors, deleteSchedule],
  getSchedulesbyUserid,

  scheduleScaleController,
  getAllFutureSchedulesForUser,
  SpanishscheduleScaleController,
  RomanionScheduleScaleController,
  getScheduleByUSERIDController,
  getAllScheduleFirstRecordForEachUserController,
};
