const studyModel = require("../../models/study_enrolled/studyModel");
const auditLog = require("../../middleware/audit_logger.js");
const db = require("../../config/DBConnection3.js");
const cron = require("node-cron");
const createStudy = async (req, res) => {
  try {
    const {
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      days, // New field: array of day objects
    } = req.body;

    // Validate required fields
    if (
      !study_name ||
      study_name.length === 0 ||
      !start_date ||
      !end_date ||
      !lower_age_limit ||
      !upper_age_limit ||
      !genders ||
      !days
    ) {
      return res.status(400).json("All fields are required.");
    }

    // Check if study_name already exists
    const existingStudy = await studyModel.getStudyByName(study_name);
    if (existingStudy) {
      return res.status(400).json({ message: "Study name already exists." });
    }

    // Validate genders field
    const validGenders = ["male", "female", "other", "none"];
    if (
      !Array.isArray(genders) ||
      genders.some((gender) => !validGenders.includes(gender))
    ) {
      return res
        .status(400)
        .json("Invalid genders. Allowed values are 'male', 'female', 'none'.");
    }

    // Validate days field
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json("Days data is required.");
    }

    // Additional validation for each day
    for (const day of days) {
      const { schedule_id, day_name, day_order, offset } = day;
      if (!day_name || day_order === undefined || offset === undefined) {
        return res
          .status(400)
          .json("Each day must have 'day_name', 'day_order', and 'offset'.");
      }
    }

    // Call the model function to create the study
    const result = await studyModel.createStudy(
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      days
    );

    // Prepare data for audit logging
    const newData = {
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      days,
    };

    // Log the creation with audit logger
    auditLog(
      "CREATE", // Operation type
      "studies", // Table name
      null, // No old value as this is a new creation
      newData, // New values being created
      "New study and associated days created." // Description
    )(req, res, () => {});

    res.status(200).json({
      message: "Study and schedule days created successfully.",
      study_id: result.study_id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllStudyController = async (req, res) => {
  try {
    const studies = await studyModel.getAllStudy();
    res.status(200).json(studies);
  } catch (error) {
    console.error("Error in getAllStudyController:", error);
    res.status(500).json({ error: error.message });
  }
};

const getStudyByIdController = async (req, res) => {
  try {
    const study_id = req.params.id;
    const result = await studyModel.getStudyById(study_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

const updateStudyController = async (req, res) => {
  try {
    const {
      study_id,
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      days,
      removedDays,
      disabled,
    } = req.body;

    // Fetch the old value of the study for auditing
    const oldStudy = await studyModel.getStudyById(study_id);
    if (!oldStudy || oldStudy.length === 0) {
      return res.status(404).json({ message: "Study not found." });
    }

    // Check if the study_name already exists for a different study_id
    const existingStudy = await studyModel.getStudyByName(study_name);
    if (existingStudy && existingStudy.enrolled_id !== parseInt(study_id)) {
      return res.status(400).json({
        message: "Study name already exists. Please choose a different name.",
      });
    }

    // Call the model function to update the study
    const result = await studyModel.updateStudy(
      study_id,
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      days,
      removedDays,
      disabled
    );

    // Prepare old and new data for audit logging
    const oldValue = {
      study_name: oldStudy[0].study_name,
      start_date: oldStudy[0].start_date,
      end_date: oldStudy[0].end_date,
      lower_age_limit: oldStudy[0].lower_age_limit,
      upper_age_limit: oldStudy[0].upper_age_limit,
      genders: oldStudy[0].genders,
      disabled: oldStudy[0].disabled || 0,
      days: oldStudy[0].days,
    };

    const newValue = {
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      genders,
      disabled: disabled !== undefined ? disabled : oldStudy[0].disabled || 0,
      days,
      removedDays,
    };

    // Determine the operation type and description based on whether the study is being cancelled
    let operationType = "UPDATE";
    let description = "Study updated successfully.";
    let responseMessage = description;

    // Check if this is a cancellation operation
    const isCancellation =
      disabled === 1 && (!oldStudy[0].disabled || oldStudy[0].disabled === 0);

    if (isCancellation) {
      operationType = "CANCEL";
      description = "Study has been cancelled.";
      responseMessage =
        "Study has been cancelled. All associated subjects have been cancelled, their medications and schedules have been marked as disabled, and any incident reports have been archived.";

      console.log(
        `Study ${enrolled_id} is being cancelled. Cascading effects will be handled by the model.`
      );
    }

    // Log the update with the audit logger
    auditLog(
      operationType, // Operation type
      "studies", // Table name
      oldValue, // Old value
      newValue, // New value
      description // Description
    )(req, res, () => {});

    res.status(200).json({
      message: responseMessage,
      result,
    });
  } catch (error) {
    console.error("Error in updateStudyController:", error);
    res.status(500).json({ error: error.message });
  }
};

const countStudyController = async (req, res) => {
  try {
    const result = await studyModel.countStudyModel();
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get user studies
const fetchUserStudies = async (req, res) => {
  const user_id = req.params.id;

  console.log("......userid......");

  try {
    console.log("Fetching studies for user_id:", user_id);

    const studies = await studyModel.getUserStudies(user_id);

    console.log("Studies fetched:", studies);

    if (studies.length === 0) {
      console.log("No studies found for user_id:", user_id);
      return res.status(404).json({
        status: false,
        message: "No studies found for this user.",
      });
    }

    res.status(200).json({
      status: true,
      data: studies,
    });
  } catch (err) {
    console.error("Error fetching user studies:", err);
    res.status(500).json({
      status: false,
      message: "An error occurred while fetching user studies.",
    });
  }
};

const fetchUserStudiesByRole = async (req, res) => {
  const role_id = req.params.id;

  try {
    const studies = await studyModel.getUserStudiesByRole(role_id);

    if (studies.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No studies found for users with this role.",
      });
    }

    res.status(200).json({
      status: true,
      data: studies,
    });
  } catch (err) {
    console.error("Error fetching studies by role:", err);
    res.status(500).json({
      status: false,
      message: "An error occurred while fetching studies by role.",
    });
  }
};

const fetchScheduleNames = async (req, res) => {
  try {
    const scheduleNames = await studyModel.fetchScheduleNames();
    res.status(200).json(scheduleNames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Controller to check and update study statuses based on end date
const checkAndUpdateStudyStatus = async (req, res) => {
  try {
    const result = await studyModel.checkAndUpdateStudyStatus();

    // Log the operation with audit logger if any studies were cancelled
    if (result.count > 0) {
      auditLog(
        "CANCEL", // Operation type
        "studies", // Table name
        { auto_cancelled: true }, // Old value
        {
          auto_cancelled: true,
          count: result.count,
          studyIds: result.studyIds,
        }, // New value
        "Studies automatically cancelled due to end date passing" // Description
      )(req, res, () => {});
    }

    res.status(200).json({
      message: result.message,
      count: result.count,
      studyIds: result.studyIds || [],
    });
  } catch (error) {
    console.error("Error in checkAndUpdateStudyStatus controller:", error);
    res.status(500).json({ error: error.message });
  }
};

// const disableStudy = async (req, res) => {
//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     // 1. Get all enrolled studies
//     const [enrollments] = await connection.execute(
//       `SELECT enrolled_id, end_date
//        FROM study_enrolled`
//     );

//     // 2. Filter to those already ended
//     const now = new Date();
//     console.log("Current date:", now.toISOString());

//     // Enhanced debugging for date comparisons
//     console.log("Examining study end dates:");

//     const expiredIds = enrollments
//       .filter((enrollment) => {
//         // Ensure end_date is a valid date string
//         if (!enrollment.end_date) {
//           console.log(`ID: ${enrollment.enrolled_id} - No end date defined`);
//           return false;
//         }

//         const endDate = new Date(enrollment.end_date);
//         console.log(endDate, "===========end date==================");
//         const isExpired = now > endDate;

//         // Log the comparison
//         console.log(
//           `ID: ${enrollment.enrolled_id}, End date: ${
//             enrollment.end_date
//           }, JS Date: ${endDate.toISOString()}, Expired: ${isExpired}`
//         );

//         return isExpired;
//       })
//       .map((enrollment) => enrollment.enrolled_id);

//     console.log(expiredIds, "==========Check expired ids===========");

//     if (expiredIds.length === 0) {
//       await connection.rollback();
//       return res.status(200).json({ message: "No studies to disable." });
//     }

//     // 3. Find all users tied to those studies
//     const [orgRows] = await connection.execute(
//       `SELECT DISTINCT user_id
//        FROM organization
//        WHERE study_enrolled_id IN (?)
//       `,
//       [expiredIds]
//     );
//     const userIds = orgRows.map((r) => r.user_id);
//     console.log(userIds, "==========Check user ids===========");

//     console.log(
//       `Found ${userIds.length} users associated with expired studies`
//     );

//     // Check if we have any users to process
//     if (userIds.length === 0) {
//       await connection.commit();
//       return res
//         .status(200)
//         .json({ message: "No users found for expired studies." });
//     }

//     // Build a placeholder string like "?, ?, ?" for IN clauses
//     const placeholders = userIds.map(() => "?").join(", ");

//     // 4a. Disable their patient accounts
//     await connection.execute(
//       `UPDATE patient_account_status
//          SET account_status = 'Disabled'
//        WHERE user_id IN (${placeholders})
//       `,
//       userIds
//     );

//     // 4b. Disable their medications
//     await connection.execute(
//       `UPDATE patientmedications
//          SET disable_status = 'Disable'
//        WHERE patient_id IN (${placeholders})
//       `,
//       userIds
//     );

//     // 4c. Disable their schedules
//     await connection.execute(
//       `UPDATE schedule
//          SET disable_status = 'Disable'
//        WHERE user_id IN (${placeholders})
//       `,
//       userIds
//     );

//     // 5a. Find all incident_report IDs for these users
//     const [incRows] = await connection.execute(
//       `SELECT id
//        FROM incident_reports
//        WHERE user_id IN (${placeholders})
//       `,
//       userIds
//     );
//     const incidentIds = incRows.map((r) => r.id);

//     console.log(`Found ${incidentIds.length} incident reports to archive`);

//     // 5b. Archive any related tickets
//     if (incidentIds.length > 0) {
//       const incPlaceholders = incidentIds.map(() => "?").join(", ");
//       await connection.execute(
//         `UPDATE adverse_ticketing_system
//            SET status = 'Archived'
//          WHERE incident_report_id IN (${incPlaceholders})
//         `,
//         incidentIds
//       );
//     }

//     await connection.commit();
//     res.status(200).json({
//       message: "All expired-study records have been disabled/archived.",
//       disabledStudies: expiredIds.length,
//       disabledUsers: userIds.length,
//       archivedTickets: incidentIds.length,
//     });
//   } catch (err) {
//     await connection.rollback();
//     console.error("disableStudy error:", err);
//     res.status(500).json({ error: err.message });
//   } finally {
//     connection.release();
//   }
// };

// Fix the cron job to properly call the function

const disableStudy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get all enrolled studies
    const [enrollments] = await connection.execute(
      `SELECT enrolled_id, end_date
       FROM study_enrolled`
    );

    // 2. Filter to those already ended
    const now = new Date();
    console.log("Current date:", now.toISOString());

    // Enhanced debugging for date comparisons
    console.log("Examining study end dates:");

    const expiredIds = enrollments
      .filter((enrollment) => {
        // Ensure end_date is a valid date string
        if (!enrollment.end_date) {
          console.log(`ID: ${enrollment.enrolled_id} - No end date defined`);
          return false;
        }

        const endDate = new Date(enrollment.end_date);
        console.log(endDate, "===========end date==================");
        const isExpired = now > endDate;

        // Log the comparison
        console.log(
          `ID: ${enrollment.enrolled_id}, End date: ${
            enrollment.end_date
          }, JS Date: ${endDate.toISOString()}, Expired: ${isExpired}`
        );

        return isExpired;
      })
      .map((enrollment) => enrollment.enrolled_id);

    console.log(expiredIds, "==========Check expired ids===========");

    if (expiredIds.length === 0) {
      await connection.rollback();
      return res.status(200).json({ message: "No studies to disable." });
    }

    // 3. Find all users tied to those studies
    // Fix: Create proper placeholders for the IN clause
    const idPlaceholders = expiredIds.map(() => "?").join(", ");

    console.log(`SQL Placeholders for expired IDs: ${idPlaceholders}`);
    console.log(`Expired IDs being used: ${expiredIds.join(", ")}`);

    const [orgRows] = await connection.execute(
      `SELECT DISTINCT o.user_id
       FROM organization AS o
       JOIN user_role AS ur ON o.user_id = ur.user_id
       JOIN role AS r ON ur.role_id = r.role_id
       WHERE study_enrolled_id IN (${idPlaceholders}) AND r.role_id = 10
      `,
      expiredIds // Pass expiredIds directly as an array of values
    );

    const userIds = orgRows.map((r) => r.user_id);
    console.log(userIds, "==========Check user ids===========");

    console.log(
      `Found ${userIds.length} users associated with expired studies`
    );

    // Check if we have any users to process
    if (userIds.length === 0) {
      await connection.commit();
      return res
        .status(200)
        .json({ message: "No users found for expired studies." });
    }

    // Build a placeholder string like "?, ?, ?" for IN clauses
    const placeholders = userIds.map(() => "?").join(", ");

    // 4a. Disable their patient accounts
    await connection.execute(
      `UPDATE patient_account_status
         SET account_status = 'Disabled'
       WHERE user_id IN (${placeholders})
      `,
      userIds
    );

    // 4b. Disable their medications
    await connection.execute(
      `UPDATE patientmedications
         SET disable_status = 'Disable'
       WHERE user_id IN (${placeholders})
      `,
      userIds
    );

    // 4c. Disable their schedules
    await connection.execute(
      `UPDATE schedule
         SET disable_status = 'Disable'
       WHERE user_id IN (${placeholders})
      `,
      userIds
    );

    // 5a. Find all incident_report IDs for these users
    const [incRows] = await connection.execute(
      `SELECT id
       FROM incident_reports
       WHERE user_id IN (${placeholders})
      `,
      userIds
    );
    const incidentIds = incRows.map((r) => r.id);

    console.log(`Found ${incidentIds.length} incident reports to archive`);

    // 5b. Archive any related tickets
    if (incidentIds.length > 0) {
      const incPlaceholders = incidentIds.map(() => "?").join(", ");
      await connection.execute(
        `UPDATE adverse_ticketing_system
           SET status = 'Archived'
         WHERE incident_report_id IN (${incPlaceholders})
        `,
        incidentIds
      );
    }

    await connection.commit();
    res.status(200).json({
      message: "All expired-study records have been disabled/archived.",
      disabledStudies: expiredIds.length,
      disabledUsers: userIds.length,
      archivedTickets: incidentIds.length,
    });
  } catch (err) {
    await connection.rollback();
    console.error("disableStudy error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

cron.schedule("* * * * *", async () => {
  console.log("Checking for expired studies...");
  try {
    // Create mock request and response objects for the function
    const req = {};
    const res = {
      status: (code) => {
        console.log(`Status: ${code}`);
        return {
          json: (data) => {
            console.log("Response:", data);
          },
        };
      },
    };

    await disableStudy(req, res);
  } catch (error) {
    console.error("Error in cron job:", error);
  }
});

module.exports = {
  createStudy,
  getAllStudyController,
  countStudyController,
  getStudyByIdController,
  updateStudyController,
  fetchUserStudies,
  fetchUserStudiesByRole,
  fetchScheduleNames,
  checkAndUpdateStudyStatus,
};
