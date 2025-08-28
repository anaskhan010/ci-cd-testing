// models/study_model.js

const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Function to create a study
const createStudy = async (
  study_name,
  start_date,
  end_date,
  lower_age_limit,
  upper_age_limit,
  genders,
  days // New parameter
) => {
  // Validate dates and age limits
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (startDate > endDate) {
    throw new Error("Start date cannot be greater than end date.");
  }

  if (
    lower_age_limit < 0 ||
    upper_age_limit < 0 ||
    lower_age_limit > upper_age_limit
  ) {
    throw new Error("Check your age limits again.");
  }

  // Convert genders array to JSON string
  const gendersJson = JSON.stringify(genders);

  const connection = await db.getConnection();
  try {
    // Begin a transaction
    await connection.beginTransaction();

    // Insert the study into the database
    const insertStudyQuery = `
      INSERT INTO study_enrolled (study_name, start_date, end_date, lower_age_limit, upper_age_limit, genders)
      VALUES (?, ?, ?, ?, ?, ?)`;

    const studyData = [
      study_name,
      start_date,
      end_date,
      lower_age_limit,
      upper_age_limit,
      gendersJson,
    ];

    const [result] = await connection.query(insertStudyQuery, studyData);

    const study_id = result.insertId;

    // Prepare the schedule_days data
    const scheduleDaysData = days.map((day) => [
      day.schedule_id || null, // If schedule_id is optional
      day.day_name,
      day.day_order,
      day.offset,
      study_id,
    ]);

    // Insert schedule_days data
    const insertDaysQuery = `
      INSERT INTO schedule_days (schedule_id, day_name, day_order, offset, study_id)
      VALUES ?`;

    const [res] = await connection.query(insertDaysQuery, [scheduleDaysData]);

    // Commit the transaction
    await connection.commit();

    console.log("Study and schedule days inserted successfully.");
    return { study_id };
  } catch (err) {
    await connection.rollback();
    console.error("Error inserting study or schedule days:", err);
    throw err;
  } finally {
    connection.release();
  }
};

// Function to get all studies
const getAllStudy = async () => {
  try {
    const query = `
      SELECT
        s.enrolled_id,
        s.study_name,
        s.start_date,
        s.end_date,
        s.lower_age_limit,
        s.upper_age_limit,
        s.genders,
        s.disabled,
        GROUP_CONCAT(
          CONCAT_WS('||',
            d.day_id,
            IFNULL(d.schedule_id, ''),
            d.day_name,
            d.day_order,
            d.offset,
            IFNULL(sc.schedule_name, ''),
            IFNULL(sc.order_num, '')
          ) SEPARATOR '##'
        ) AS days
      FROM study_enrolled s
      LEFT JOIN schedule_days d ON s.enrolled_id = d.study_id
      LEFT JOIN study_schedules sc ON d.schedule_id = sc.schedule_id
      GROUP BY s.enrolled_id
    `;

    const [results] = await db.query(query);

    // Process each study
    const studies = results.map((study) => {
      // Parse genders JSON string to array
      study.genders = JSON.parse(study.genders);

      // Initialize days array
      let daysArray = [];

      if (study.days && study.days !== null) {
        // Split the days string into individual days
        const daysStrArray = study.days.split("##");
        daysStrArray.forEach((dayStr) => {
          if (dayStr) {
            const dayFields = dayStr.split("||");
            const day = {
              day_id: parseInt(dayFields[0]),
              schedule_id: dayFields[1] ? parseInt(dayFields[1]) : null,
              day_name: dayFields[2],
              day_order: parseInt(dayFields[3]),
              offset: parseInt(dayFields[4]),
              schedule_name: dayFields[5] || null,
              order_num: dayFields[6] ? parseInt(dayFields[6]) : null,
            };
            daysArray.push(day);
          }
        });
      }

      // Replace study.days with the array of day objects
      study.days = daysArray;

      return study;
    });

    return studies;
  } catch (err) {
    console.error("Error fetching studies: ", err);
    throw err;
  }
};

const getStudyByName = async (study_name) => {
  const query = "SELECT * FROM study_enrolled WHERE study_name = ?";
  const [rows] = await db.execute(query, [study_name]);
  return rows[0] || null;
};

// Function to get a study by ID
const getStudyById = async (study_id) => {
  try {
    const query = "SELECT * FROM study_enrolled WHERE enrolled_id = ?";
    const [res] = await db.query(query, [study_id]);
    return res;
  } catch (err) {
    console.error("Error fetching study by ID: ", err);
    throw err;
  }
};

// Function to update a study
const updateStudy = async (
  study_id,
  study_name,
  start_date,
  end_date,
  lower_age_limit,
  upper_age_limit,
  genders,
  days,
  removedDays,
  disabled = null
) => {
  // First, check if the study is already disabled
  const [existingStudy] = await db.query(
    "SELECT disabled FROM study_enrolled WHERE enrolled_id = ?",
    [study_id]
  );

  if (existingStudy.length === 0) {
    throw new Error("Study not found.");
  }

  // If the study is already disabled, it cannot be re-enabled
  if (existingStudy[0].disabled === 1 && disabled === 0) {
    throw new Error("Disabled studies cannot be re-enabled.");
  }

  // Validate dates and age limits
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (startDate > endDate) {
    throw new Error("Start date cannot be greater than end date.");
  }

  if (
    lower_age_limit < 0 ||
    upper_age_limit < 0 ||
    lower_age_limit > upper_age_limit
  ) {
    throw new Error("Check your age limits again.");
  }

  // Convert genders array to JSON string
  const gendersJson = JSON.stringify(genders);

  const connection = await db.getConnection();
  try {
    // Begin transaction
    await connection.beginTransaction();

    // Update the study in the database
    let query, studyParams;

    // Include disabled field in the update if it's provided
    if (disabled !== null) {
      query = `UPDATE study_enrolled SET study_name = ?, start_date = ?, end_date = ?, lower_age_limit = ?, upper_age_limit = ?, genders = ?, disabled = ? WHERE enrolled_id = ?`;
      studyParams = [
        study_name,
        start_date,
        end_date,
        lower_age_limit,
        upper_age_limit,
        gendersJson,
        disabled,
        study_id,
      ];
    } else {
      query = `UPDATE study_enrolled SET study_name = ?, start_date = ?, end_date = ?, lower_age_limit = ?, upper_age_limit = ?, genders = ? WHERE enrolled_id = ?`;
      studyParams = [
        study_name,
        start_date,
        end_date,
        lower_age_limit,
        upper_age_limit,
        gendersJson,
        study_id,
      ];
    }

    await connection.query(query, studyParams);

    // Handle removed days
    if (removedDays && removedDays.length > 0) {
      const deleteQuery = `DELETE FROM schedule_days WHERE day_id IN (?)`;
      await connection.query(deleteQuery, [removedDays]);
    }

    // Handle days
    if (days && days.length > 0) {
      const dayPromises = days.map(async (day) => {
        if (day.day_id) {
          // Update existing day
          const updateDayQuery = `UPDATE schedule_days SET schedule_id = ?, day_name = ?, day_order = ?, offset = ? WHERE day_id = ? AND study_id = ?`;
          const updateDayParams = [
            day.schedule_id,
            day.day_name,
            day.day_order,
            day.offset,
            day.day_id,
            study_id,
          ];
          await connection.query(updateDayQuery, updateDayParams);
        } else {
          // Insert new day
          const insertDayQuery = `INSERT INTO schedule_days (schedule_id, day_name, day_order, offset, study_id) VALUES (?, ?, ?, ?, ?)`;
          const insertDayParams = [
            day.schedule_id,
            day.day_name,
            day.day_order,
            day.offset,
            study_id,
          ];
          await connection.query(insertDayQuery, insertDayParams);
        }
      });

      await Promise.all(dayPromises);
    }

    // Commit transaction
    await connection.commit();

    // If the study is being disabled, handle cascading effects
    if (
      disabled === 1 &&
      (!existingStudy[0].disabled || existingStudy[0].disabled === 0)
    ) {
      console.log(
        `Study ${study_id} is being cancelled. Handling cascading effects...`
      );

      // Call the function to handle cascading effects
      // This needs to be awaited to ensure it completes before returning
      const cascadeResult = await handleStudyDisabled(study_id);
      console.log("Cascade result:", cascadeResult);
    }

    return { message: "Study updated successfully" };
  } catch (err) {
    await connection.rollback();
    console.error("Error updating study:", err);
    throw err;
  } finally {
    connection.release();
  }
};

// Function to count studies
const countStudyModel = async () => {
  try {
    const query = `
      SELECT COUNT(*) AS count
      FROM organization_details

    `;

    const [res] = await db.query(query);
    return res[0].count; // Return the count directly
  } catch (err) {
    throw err;
  }
};

// Function to get user studies by user ID
const getUserStudies = async (userId) => {
  try {
    console.log("Starting getUserStudies with userId:", userId);

    // Step 1: Check user's role_id in the user_role table
    console.log("Checking user's role_id in user_role table");
    const [roleResult] = await db.query(
      `SELECT role_id FROM user_role WHERE user_id = ?`,
      [userId]
    );
    console.log("Role query result:", roleResult);

    // Default to role_id 10 (subject) if no role is found
    let roleId = 10;
    if (roleResult && roleResult.length > 0) {
      roleId = roleResult[0].role_id;
    }
    console.log(`User role_id: ${roleId}`);

    let studyIds = [];

    // Step 2: Based on role_id, get studies from appropriate table
    if (roleId === 10) {
      // For subjects (role_id = 10), get study_enrolled_id from organization table
      console.log("Role is subject (10), checking organization table");
      const [orgResult] = await db.query(
        `SELECT study_enrolled_id FROM organization WHERE user_id = ?`,
        [userId]
      );
      console.log("Organization query result:", orgResult);

      // Check if study_enrolled_id exists and is not empty
      if (
        orgResult.length === 0 ||
        !orgResult[0].study_enrolled_id ||
        orgResult[0].study_enrolled_id.trim() === ""
      ) {
        console.log("No study_enrolled_id found for subject userId:", userId);
        return []; // No studies found
      }

      // Split the study_enrolled_id string into an array and convert to integers
      studyIds = orgResult[0].study_enrolled_id
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id)); // Filter out any non-numeric values
    } else {
      // For non-subjects (role_id != 10), get study_id from personnel_assigned_sites_studies
      console.log(
        "Role is not subject, checking personnel_assigned_sites_studies table"
      );
      const [passResult] = await db.query(
        `SELECT study_id FROM personnel_assigned_sites_studies WHERE personnel_id = ?`,
        [userId]
      );
      console.log("Personnel assigned sites studies query result:", passResult);

      if (passResult.length === 0) {
        console.log("No studies assigned to personnel with userId:", userId);
        return []; // No studies found
      }

      // Extract study_ids from the result
      studyIds = passResult
        .map((item) => item.study_id)
        .filter((id) => id !== null);
    }

    // Debugging: Log the studyIds
    console.log("Study IDs:", studyIds);

    if (studyIds.length === 0) {
      console.log("No valid study IDs found after processing");
      return []; // No valid study IDs found
    }

    // Step 3: Perform a query to get study details from the study_enrolled table
    console.log("Executing query to fetch studies");
    const [studies] = await db.query(
      `SELECT s.*
       FROM study_enrolled s
       WHERE s.enrolled_id IN (?)`,
      [studyIds]
    );
    console.log("Studies query result:", studies);

    return studies;
  } catch (err) {
    console.error("Error in getUserStudies:", err);
    throw err;
  }
};
// Function to get user studies by role ID
const getUserStudiesByRole = async (roleId) => {
  console.log(roleId, "Model");
  try {
    // Step 1: Get the study_enrolled_id from the organization table
    const [result] = await db.query(
      `SELECT study_enrolled_id FROM organization WHERE role_id = ?`,
      [roleId]
    );

    // Step 2: Check if study_enrolled_id exists
    if (result.length === 0 || !result[0].study_enrolled_id) {
      return []; // No studies found
    }

    // Step 3: Split the study_enrolled_id string into an array
    const enrolledIds = result[0].study_enrolled_id.split(",");

    // Step 4: Perform a query to get study names from the study table
    const [studies] = await db.query(
      `SELECT s.enrolled_id, s.study_name
       FROM study_enrolled s
       WHERE s.enrolled_id IN (?)`,
      [enrolledIds]
    );

    return studies;
  } catch (err) {
    throw err;
  }
};

// Function to fetch schedule names
const fetchScheduleNames = async () => {
  try {
    const query = `SELECT * FROM study_schedules`;
    const [res] = await db.query(query);
    return res;
  } catch (err) {
    throw err;
  }
};

// Function to handle cascading effects when a study is cancelled
const handleStudyDisabled = async (studyId) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    console.log(`Starting cascading effects for study ID ${studyId}`);

    // 1. Get all users with role_id 10 (subjects) associated with this study
    const [subjects] = await connection.query(
      `SELECT o.user_id
       FROM organization o
       JOIN user_role ur ON o.user_id = ur.user_id
       WHERE FIND_IN_SET(?, o.study_enrolled_id) > 0
       AND ur.role_id = 10`,
      [studyId]
    );

    if (subjects.length === 0) {
      console.log(`No subjects found for study ID ${studyId}`);
      await connection.commit();
      return { message: "No subjects found for this study" };
    }

    const subjectIds = subjects.map((subject) => subject.user_id);
    console.log(
      `Found ${
        subjectIds.length
      } subjects for study ID ${studyId}: ${JSON.stringify(subjectIds)}`
    );

    // 2. Update patient_account_status to Cancelled for all subjects
    try {
      // For MySQL IN clause, we need to construct the query with the right number of placeholders
      const placeholders = subjectIds.map(() => "?").join(",");
      const updateAccountResult = await connection.query(
        `UPDATE patient_account_status
         SET account_status = 'Cancelled',
             reason = ?,
             updated_at = NOW()
         WHERE user_id IN (${placeholders})`,
        [`Study ${studyId} has been cancelled`, ...subjectIds]
      );
      console.log(
        `Updated account status for ${subjectIds.length} subjects. Result:`,
        updateAccountResult
      );
    } catch (err) {
      console.error("Error updating patient_account_status:", err);
      throw err;
    }

    // 3. Update patientmedications disable_status to Disable
    try {
      // For MySQL IN clause, we need to construct the query with the right number of placeholders
      const placeholders = subjectIds.map(() => "?").join(",");
      const updateMedsResult = await connection.query(
        `UPDATE patientmedications
         SET disable_status = 'Disable'
         WHERE user_id IN (${placeholders})`,
        [...subjectIds]
      );
      console.log(
        `Updated medications for subjects. Result:`,
        updateMedsResult
      );
    } catch (err) {
      console.error("Error updating patientmedications:", err);
      throw err;
    }

    // 4. Update schedule disable_status to Disable
    try {
      // For MySQL IN clause, we need to construct the query with the right number of placeholders
      const placeholders = subjectIds.map(() => "?").join(",");
      const updateScheduleResult = await connection.query(
        `UPDATE schedule
         SET disable_status = 'Disable'
         WHERE user_id IN (${placeholders}) AND study_enrolled_id = ?`,
        [...subjectIds, studyId]
      );
      console.log(
        `Updated schedules for subjects. Result:`,
        updateScheduleResult
      );
    } catch (err) {
      console.error("Error updating schedule:", err);
      throw err;
    }

    // 5. Update adverse_ticketing_system status to Archived
    // First, get all incident reports for these subjects
    try {
      // For MySQL IN clause, we need to construct the query with the right number of placeholders
      const placeholders = subjectIds.map(() => "?").join(",");
      const [incidentReports] = await connection.query(
        `SELECT ir.id
         FROM incident_reports ir
         WHERE ir.user_id IN (${placeholders})`,
        [...subjectIds]
      );

      if (incidentReports.length > 0) {
        const incidentReportIds = incidentReports.map((report) => report.id);

        // For MySQL IN clause, we need to construct the query with the right number of placeholders
        const placeholders = incidentReportIds.map(() => "?").join(",");
        const updateTicketsResult = await connection.query(
          `UPDATE adverse_ticketing_system
           SET status = 'Archived'
           WHERE incident_report_id IN (${placeholders})`,
          [...incidentReportIds]
        );
        console.log(
          `Updated ${incidentReportIds.length} adverse ticketing system entries. Result:`,
          updateTicketsResult
        );
      } else {
        console.log(`No incident reports found for subjects`);
      }
    } catch (err) {
      console.error("Error updating adverse_ticketing_system:", err);
      throw err;
    }

    await connection.commit();
    console.log(
      `Successfully completed cascading effects for study ID ${studyId}`
    );
    return {
      message: "Successfully processed study cancellation cascading effects",
      affectedSubjects: subjectIds.length,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error in handleStudyDisabled:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Function to check and update study status based on end date
const checkAndUpdateStudyStatus = async () => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split("T")[0];

    // Find studies where end_date has passed and disabled is not 1
    const [expiredStudies] = await connection.query(
      `SELECT enrolled_id
       FROM study_enrolled
       WHERE end_date < ?
       AND (disabled IS NULL OR disabled = 0)`,
      [currentDate]
    );

    if (expiredStudies.length === 0) {
      console.log("No expired studies found that need to be cancelled");
      await connection.commit();
      return { message: "No studies to cancel", count: 0 };
    }

    console.log(`Found ${expiredStudies.length} expired studies to cancel`);

    // Update each expired study to disabled=1
    for (const study of expiredStudies) {
      console.log(`Cancelling study with ID ${study.enrolled_id}`);

      // First update the study status
      const updateResult = await connection.query(
        `UPDATE study_enrolled SET disabled = 1 WHERE enrolled_id = ?`,
        [study.enrolled_id]
      );
      console.log(`Study update result:`, updateResult);

      // Then handle cascading effects for each cancelled study
      console.log(
        `Triggering cascading effects for study ${study.enrolled_id}`
      );
      const cascadeResult = await handleStudyDisabled(study.enrolled_id);
      console.log(
        `Cascade result for study ${study.enrolled_id}:`,
        cascadeResult
      );
    }

    await connection.commit();
    return {
      message: "Successfully cancelled expired studies",
      count: expiredStudies.length,
      studyIds: expiredStudies.map((study) => study.enrolled_id),
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error in checkAndUpdateStudyStatus:", error);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createStudy,
  getAllStudy,
  getStudyByName,
  updateStudy,
  getStudyById,
  countStudyModel,
  getUserStudies,
  getUserStudiesByRole,
  fetchScheduleNames,
  handleStudyDisabled,
  checkAndUpdateStudyStatus,
};
