var db = require("../../config/DBConnection3.js");
const crypto = require("crypto");
const {
  createMedicineLogic,
} = require("../../controllers/medication/medicineController.js");

const moment = require("moment");
const auditLog = require("../../middleware/audit_logger.js");

const medicineModel = require("../../models/medication/medicineModel.js");

// const createPatientSchedule = (
//   scheduleDate,
//   scheduleTime,
//   studyEnrolledId,
//   status,
//   note,
//   userId,
//   disable_status = "Enable",
//   reason = "Initial Schedule"
// ) => {
//   console.log(studyEnrolledId, "******************************************");

//   const initialDate = moment(scheduleDate);

//   return new Promise((resolve, reject) => {
//     // Check if schedules already exist for this user and study
//     db.query(
//       "SELECT COUNT(*) AS scheduleCount FROM schedule WHERE user_id = ? AND study_enrolled_id = ?",
//       [userId, studyEnrolledId],
//       (err, result) => {
//         if (err) {
//           return reject(err);
//         }

//         if (result[0].scheduleCount > 0) {
//           // Schedules already exist
//           return resolve({
//             message:
//               "Schedules already exist for this user and study. No new schedules were created.",
//           });
//         }

//         // Begin transaction
//         db.beginTransaction((err) => {
//           if (err) return reject(err);

//           // Retrieve initial day_id from schedule_days table
//           db.query(
//             `SELECT sd.day_id, ss.schedule_id
//              FROM schedule_days sd
//              JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
//              WHERE sd.study_id = ?
//              ORDER BY sd.day_order ASC`,
//             [studyEnrolledId],
//             (err, dayResults) => {
//               if (err) {
//                 return db.rollback(() => {
//                   reject(err);
//                 });
//               }

//               console.log(
//                 dayResults,
//                 "============================================="
//               );

//               if (!dayResults || dayResults.length === 0) {
//                 return db.rollback(() => {
//                   reject(
//                     new Error("No initial day found for the provided schedule.")
//                   );
//                 });
//               }

//               const initialDayId = dayResults[0].day_id;
//               console.log(
//                 initialDayId,
//                 "===================@@@@@@@@@@@@@=========================="
//               );

//               if (!initialDayId) {
//                 return db.rollback(() => {
//                   reject(new Error("Initial day_id is undefined."));
//                 });
//               }

//               // Check if any schedule already exists for the user, study_enrolled_id, date, time, and day_id
//               db.query(
//                 "SELECT schedule_id FROM schedule WHERE user_id = ? AND study_enrolled_id = ? AND schedule_date = ? AND schedule_time = ? AND day_id = ?",
//                 [
//                   userId,
//                   studyEnrolledId,
//                   scheduleDate,
//                   scheduleTime,
//                   initialDayId,
//                 ],
//                 (err, existingSchedules) => {
//                   if (err) {
//                     return db.rollback(() => {
//                       reject(err);
//                     });
//                   }

//                   if (existingSchedules.length > 0) {
//                     return db.rollback(() => {
//                       resolve({
//                         message:
//                           "A schedule for this user, study, date, time, and day already exists.",
//                         scheduleId: existingSchedules[0].schedule_id,
//                       });
//                     });
//                   }

//                   // Proceed with the initial schedule creation
//                   db.query(
//                     "INSERT INTO schedule (schedule_date, schedule_time, status, note, disable_status, reason, user_id, study_enrolled_id, day_id) VALUES (?,?,?,?,?,?,?,?,?)",
//                     [
//                       scheduleDate,
//                       scheduleTime,
//                       status,
//                       note,
//                       disable_status,
//                       reason,
//                       userId,
//                       studyEnrolledId,
//                       initialDayId,
//                     ],
//                     (err, initialScheduleResult) => {
//                       if (err) {
//                         return db.rollback(() => {
//                           reject(err);
//                         });
//                       }

//                       console.log(
//                         initialScheduleResult,
//                         "initialScheduleResult"
//                       );

//                       if (!initialScheduleResult.insertId) {
//                         return db.rollback(() => {
//                           reject(
//                             new Error("Failed to create initial schedule.")
//                           );
//                         });
//                       }

//                       const initialScheduleId = dayResults[0].schedule_id;

//                       // Insert initial schedule_scale_status using the correct schedule_id
//                       db.query(
//                         "INSERT INTO schedule_scale_status (schedule_id, user_id, day_id, status, is_accessible) VALUES (?, ?, ?, 'Pending', 1)",
//                         [initialScheduleId, userId, initialDayId],
//                         (err) => {
//                           if (err) {
//                             return db.rollback(() => {
//                               reject(err);
//                             });
//                           }

//                           // Retrieve schedule days and related scales from schedule_days table for subsequent schedules
//                           db.query(
//                             `SELECT sd.day_name, sd.day_id, sd.offSet, ss.schedule_id, ss.schedule_name
//                              FROM schedule_days sd
//                              JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
//                              WHERE sd.study_id = ?
//                              ORDER BY sd.day_order ASC`,
//                             [studyEnrolledId],
//                             (err, scheduleDays) => {
//                               if (err) {
//                                 return db.rollback(() => {
//                                   reject(err);
//                                 });
//                               }

//                               if (!scheduleDays || scheduleDays.length === 0) {
//                                 return db.rollback(() => {
//                                   reject(
//                                     new Error(
//                                       "No schedule days found for the provided study_id."
//                                     )
//                                   );
//                                 });
//                               }

//                               // Initialize cumulativeOffset
//                               let cumulativeOffset = 0;

//                               // Insert all subsequent schedules and their corresponding schedule_scale_status
//                               const insertSubsequentSchedules = (index) => {
//                                 if (index >= scheduleDays.length) {
//                                   return db.commit((err) => {
//                                     if (err) {
//                                       return db.rollback(() => {
//                                         reject(err);
//                                       });
//                                     }
//                                     resolve({
//                                       message:
//                                         "Patient schedule created successfully",
//                                       scheduleId: initialScheduleId,
//                                     });
//                                   });
//                                 }

//                                 const day = scheduleDays[index];
//                                 if (!day || !day.day_id) {
//                                   return insertSubsequentSchedules(index + 1); // Skip invalid days
//                                 }

//                                 // Accumulate the offset
//                                 cumulativeOffset += day.offSet;

//                                 const subsequentScheduleDate = initialDate
//                                   .clone()
//                                   .add(cumulativeOffset, "days")
//                                   .format("YYYY-MM-DD");

//                                 console.log(
//                                   subsequentScheduleDate,
//                                   "subsequentScheduleDate"
//                                 );

//                                 // Adjust the check to include day_id
//                                 db.query(
//                                   "SELECT schedule_id FROM schedule WHERE schedule_date = ? AND user_id = ? AND study_enrolled_id = ? AND day_id = ?",
//                                   [
//                                     subsequentScheduleDate,
//                                     userId,
//                                     studyEnrolledId,
//                                     day.day_id,
//                                   ],
//                                   (err, existingSubsequentSchedules) => {
//                                     if (err) {
//                                       return db.rollback(() => {
//                                         reject(err);
//                                       });
//                                     }

//                                     if (
//                                       existingSubsequentSchedules.length === 0
//                                     ) {
//                                       // Insert subsequent schedule
//                                       db.query(
//                                         "INSERT INTO schedule (schedule_date, schedule_time, status, note, disable_status, reason, user_id, study_enrolled_id, day_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
//                                         [
//                                           subsequentScheduleDate,
//                                           scheduleTime,
//                                           "Pending",
//                                           `Auto-scheduled for ${day.schedule_name} ${day.day_name}`,
//                                           disable_status,
//                                           reason,
//                                           userId,
//                                           studyEnrolledId,
//                                           day.day_id,
//                                         ],
//                                         (err, scheduleResult) => {
//                                           if (err) {
//                                             return db.rollback(() => {
//                                               reject(err);
//                                             });
//                                           }

//                                           console.log(
//                                             scheduleResult,
//                                             "scheduleResult"
//                                           );

//                                           if (!scheduleResult.insertId) {
//                                             console.error(
//                                               `Failed to insert schedule for day ${day.day_name}`
//                                             );
//                                             return insertSubsequentSchedules(
//                                               index + 1
//                                             );
//                                           }

//                                           const newScheduleId =
//                                             scheduleResult.insertId;

//                                           // Insert schedule_scale_status with correct schedule_id
//                                           db.query(
//                                             "INSERT INTO schedule_scale_status (schedule_id, user_id, day_id, status, is_accessible) VALUES (?, ?, ?, 'Pending', ?)",
//                                             [
//                                               day.schedule_id,
//                                               userId,
//                                               day.day_id,
//                                               0, // Set is_accessible to 0 for all subsequent schedules
//                                             ],
//                                             (err) => {
//                                               if (err) {
//                                                 return db.rollback(() => {
//                                                   reject(err);
//                                                 });
//                                               }
//                                               insertSubsequentSchedules(
//                                                 index + 1
//                                               );
//                                             }
//                                           );
//                                         }
//                                       );
//                                     } else {
//                                       insertSubsequentSchedules(index + 1);
//                                     }
//                                   }
//                                 );
//                               };

//                               // Start inserting subsequent schedules from index 1
//                               insertSubsequentSchedules(1);
//                             }
//                           );
//                         }
//                       );
//                     }
//                   );
//                 }
//               );
//             }
//           );
//         });
//       }
//     );
//   });
// };
// Encryption constants

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
const getOrganizationById = async (user_id) => {
  try {
    const [result] = await db.query(
      `
      SELECT o.*, u.email,
       org.organization_name, org.organization_address, notes.note,
       GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
       GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
       GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
       GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
       GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
      FROM organization AS o
      JOIN user AS u ON o.user_id = u.user_id
      JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
      LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
      LEFT JOIN (
        SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id
        FROM organization AS inv_org
        JOIN user_role AS r ON inv_org.user_id = r.user_id
        WHERE r.role_id = 12
      ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
      JOIN (
        SELECT user_id, MAX(note) AS note
        FROM note
        GROUP BY user_id
      ) AS notes ON u.user_id = notes.user_id
      WHERE o.user_id = ?
      GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
               org.organization_name, org.organization_address, notes.note
      `,
      [user_id]
    );

    if (result.length > 0) {
      let org = result[0];

      try {
        const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];
        const investigatorUserIds = org.investigator_user_ids
          ? org.investigator_user_ids.split(",")
          : [];
        const investigatorFirstNames = org.investigator_first_names
          ? org.investigator_first_names.split(",")
          : [];
        const investigatorLastNames = org.investigator_last_names
          ? org.investigator_last_names.split(",")
          : [];

        // Decrypt investigator first and last names individually
        const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
          user_id: parseInt(id),
          first_name: decrypt(investigatorFirstNames[index] || ""),
          last_name: decrypt(investigatorLastNames[index] || ""),
        }));

        org = {
          ...org,
          first_name: decrypt(org.first_name),
          middle_name: decrypt(org.middle_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
          investigators: decryptedInvestigators,
        };

        // Remove raw investigator_first_names and investigator_last_names from the result
        delete org.investigator_first_names;
        delete org.investigator_last_names;
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
      }

      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

const createPatientSchedule = async (
  scheduleDate,
  scheduleTime,
  studyEnrolledId,
  status,
  note,
  userId,
  disable_status = "Enable",
  reason = "Initial Schedule"
) => {
  console.log(studyEnrolledId, "******************************************");

  const initialDate = moment(scheduleDate);

  const connection = await db.getConnection();
  try {
    // Check if schedules already exist for this user and study
    const [result] = await connection.query(
      "SELECT COUNT(*) AS scheduleCount FROM schedule WHERE user_id = ? AND study_enrolled_id = ?",
      [userId, studyEnrolledId]
    );

    if (result[0].scheduleCount > 0) {
      // Schedules already exist
      return {
        message:
          "Schedules already exist for this user and study. No new schedules were created.",
      };
    }

    // Begin transaction
    await connection.beginTransaction();

    // Retrieve initial day_id from schedule_days table
    const [dayResults] = await connection.query(
      `SELECT sd.day_id, ss.schedule_id
       FROM schedule_days sd
       JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
       WHERE sd.study_id = ?
       ORDER BY sd.day_order ASC`,
      [studyEnrolledId]
    );

    if (!dayResults || dayResults.length === 0) {
      await connection.rollback();
      throw new Error("No initial day found for the provided schedule.");
    }

    const initialDayId = dayResults[0].day_id;

    const initialDayIds = dayResults[0].schedule_id;

    if (!initialDayId) {
      await connection.rollback();
      throw new Error("Initial day_id is undefined.");
    }

    // Check if any schedule already exists for the user, study_enrolled_id, date, time, and day_id
    const [existingSchedules] = await connection.query(
      "SELECT schedule_id FROM schedule WHERE user_id = ? AND study_enrolled_id = ? AND schedule_date = ? AND schedule_time = ? AND day_id = ?",
      [userId, studyEnrolledId, scheduleDate, scheduleTime, initialDayId]
    );

    if (existingSchedules.length > 0) {
      await connection.rollback();
      return {
        message:
          "A schedule for this user, study, date, time, and day already exists.",
        scheduleId: existingSchedules[0].schedule_id,
      };
    }

    // Proceed with the initial schedule creation
    const [initialScheduleResult] = await connection.query(
      "INSERT INTO schedule (schedule_date, schedule_time, status, note, disable_status, reason, user_id, study_enrolled_id, day_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        scheduleDate,
        scheduleTime,
        status,
        note,
        disable_status,
        reason,
        userId,
        studyEnrolledId,
        initialDayId,
      ]
    );

    if (!initialScheduleResult.insertId) {
      await connection.rollback();
      throw new Error("Failed to create initial schedule.");
    }

    // Insert initial schedule_scale_status using the correct schedule_id
    await connection.query(
      "INSERT INTO schedule_scale_status (schedule_id, user_id, day_id, status, is_accessible) VALUES (?, ?, ?, 'Pending', 1)",
      [initialDayIds, userId, initialDayId]
    );

    // Retrieve schedule days and related scales from schedule_days table for subsequent schedules
    const [scheduleDays] = await connection.query(
      `SELECT sd.day_name, sd.day_id, sd.offSet, ss.schedule_id, ss.schedule_name
       FROM schedule_days sd
       JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
       WHERE sd.study_id = ?
       ORDER BY sd.day_order ASC`,
      [studyEnrolledId]
    );

    if (!scheduleDays || scheduleDays.length === 0) {
      await connection.rollback();
      throw new Error("No schedule days found for the provided study_id.");
    }

    // Initialize cumulativeOffset
    let cumulativeOffset = 0;

    // Insert all subsequent schedules and their corresponding schedule_scale_status
    for (let index = 1; index < scheduleDays.length; index++) {
      const day = scheduleDays[index];
      if (!day || !day.day_id) {
        continue; // Skip invalid days
      }

      // Accumulate the offset
      cumulativeOffset += day.offSet;

      const subsequentScheduleDate = initialDate
        .clone()
        .add(cumulativeOffset, "days")
        .format("YYYY-MM-DD");

      // Adjust the check to include day_id
      const [existingSubsequentSchedules] = await connection.query(
        "SELECT schedule_id FROM schedule WHERE schedule_date = ? AND user_id = ? AND study_enrolled_id = ? AND day_id = ?",
        [subsequentScheduleDate, userId, studyEnrolledId, day.day_id]
      );

      if (existingSubsequentSchedules.length === 0) {
        // Insert subsequent schedule
        const [scheduleResult] = await connection.query(
          "INSERT INTO schedule (schedule_date, schedule_time, status, note, disable_status, reason, user_id, study_enrolled_id, day_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            subsequentScheduleDate,
            scheduleTime,
            "Pending",
            `Auto-scheduled for ${day.schedule_name} ${day.day_name}`,
            disable_status,
            reason,
            userId,
            studyEnrolledId,
            day.day_id,
          ]
        );

        if (!scheduleResult.insertId) {
          console.error(`Failed to insert schedule for day ${day.day_name}`);
          continue;
        }

        // Insert schedule_scale_status with correct schedule_id
        await connection.query(
          "INSERT INTO schedule_scale_status (schedule_id, user_id, day_id, status, is_accessible) VALUES (?, ?, ?, 'Pending', ?)",
          [
            day.schedule_id,
            userId,
            day.day_id,
            0, // Set is_accessible to 0 for all subsequent schedules
          ]
        );
      }
    }

    await connection.commit();

    return {
      message: "Patient schedule created successfully",
      scheduleId: initialDayIds,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const createManualSchedule = async (
  scheduleDate,
  scheduleTime,
  studyEnrolledId,
  status,
  day_id,
  note,
  userId,
  disable_status = "Enable",
  reason = "Manual Schedule"
) => {
  console.log(scheduleDate, "======scheduele date model==========");
  try {
    const query = `
      INSERT INTO schedule
        (schedule_date, schedule_time, status, note, disable_status, reason, user_id,day_id, study_enrolled_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)
    `;
    const values = [
      scheduleDate,
      scheduleTime,
      status,
      note,
      disable_status,
      reason,
      userId,
      day_id,
      studyEnrolledId,
    ];
    const [result] = await db.execute(query, values);
    return result;
  } catch (err) {
    console.error("Create Manual Schedule Error:", err);
    throw err;
  }
};

const getDayNameByStudyId = async (studyEnrolledId) => {
  try {
    const query = `SELECT sd.day_name, sd.study_id, sd.day_id, sd.offSet, ss.schedule_id, ss.schedule_name
      FROM schedule_days sd
      JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
      WHERE sd.study_id = ?`;

    const [result] = await db.query(query, [studyEnrolledId]);

    return result;
  } catch (err) {
    throw err;
  }
};

const scheduleScaleModel = {
  getSchedules: async (userId) => {
    try {
      const query = `
        SELECT DISTINCT ss.*
        FROM schedule s
        INNER JOIN schedule_days sd ON s.day_id = sd.day_id
        INNER JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
        WHERE s.user_id = ?
        ORDER BY ss.order_num
      `;
      const [results] = await db.query(query, [userId]);
      return results;
    } catch (error) {
      throw error;
    }
  },

  getDaysForSchedule: async (scheduleId) => {
    try {
      const query =
        "SELECT * FROM schedule_days WHERE schedule_id = ? ORDER BY day_order";
      const [results] = await db.query(query, [scheduleId]);
      return results;
    } catch (error) {
      throw error;
    }
  },

  updateAccessibilityForUser: async (userId) => {
    try {
      const today = new Date().toISOString().split("T")[0]; // Get today's date in 'YYYY-MM-DD' format

      const updateQuery = `
          UPDATE schedule_scale_status sss
          JOIN schedule s ON s.user_id = sss.user_id AND s.day_id = sss.day_id
          SET sss.is_accessible = 1
          WHERE sss.user_id = ?
            AND s.schedule_date = ?;
        `;

      const [updateResults] = await db.query(updateQuery, [userId, today]);

      if (updateResults.affectedRows === 0) {
        console.log(
          `No matching schedules found for user ${userId} on ${today}`
        );
        return [];
      }

      console.log(
        `Successfully updated accessibility for user ${userId} on ${today}: ${updateResults.affectedRows} rows affected`
      );
      return {
        message: "Accessibility updated successfully",
        results: updateResults,
      };
    } catch (error) {
      console.error("Error updating accessibility:", error);
      throw error;
    }
  },
  getScalesForDay: async (scheduleId, userId, roleId, language_code) => {
    try {
      const getStudyEnrolledIdQuery = `
      SELECT study_enrolled_id
      FROM organization
      WHERE user_id = ?
    `;
      const [result] = await db.query(getStudyEnrolledIdQuery, [userId]);

      if (result.length === 0) {
        return [];
      }

      const studyEnrolledId = result[0].study_enrolled_id;
      let query = `
      SELECT DISTINCT
        sc.scale_id,
        sc.filled_by,
        COALESCE(st.scale_name) as scale_name,
        sc.role_id,
        sd.day_id,
        sd.day_name,
        sd.day_order,
        ss.schedule_name,
        ss.schedule_id,
        ss.order_num,
        sds.id as schedule_day_scale_id,
        COALESCE(sss.status, 'Pending') as status,
        sss.date_completed,
        CASE WHEN sss.is_accessible = 1 THEN 1 ELSE 0 END AS is_accessible
      FROM schedule s
      INNER JOIN schedule_days sd ON s.day_id = sd.day_id
      INNER JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
      LEFT JOIN schedule_day_scales sds ON sds.day_id = sd.day_id
      LEFT JOIN scale sc ON sc.scale_id = sds.scale_id
      LEFT JOIN scale_translations st ON sc.scale_id = st.scale_id AND st.language_code =?
      LEFT JOIN schedule_scale_status sss ON sss.day_id = sd.day_id
                                          AND sss.user_id = ?
                                          AND sss.schedule_id = ss.schedule_id
      WHERE s.disable_status = 'Enable'
        AND s.user_id = ?
        AND ss.schedule_id = ?
        AND sd.study_id = ?
      ${
        roleId !== 9 && roleId !== 12 && roleId !== 19
          ? "AND sc.role_id = ?"
          : ""
      }
      ORDER BY sd.day_order;
    `;

      const baseParams = [
        language_code,
        userId,
        userId,
        scheduleId,
        studyEnrolledId,
      ];
      const queryParams =
        roleId === 9 || roleId === 12 || roleId === 19
          ? baseParams
          : [...baseParams, roleId];

      const [results] = await db.query(query, queryParams);

      if (results.length === 0) {
        return [];
      }

      const schedule = {
        schedule_id: results[0] ? results[0].schedule_id : null,
        schedule_name: results[0] ? results[0].schedule_name : null,
        order_num: results[0] ? results[0].order_num : null,
        days: [],
      };

      const daysMap = new Map();

      results.forEach((row) => {
        const {
          day_id,
          day_name,
          day_order,
          scale_id,
          scale_name,
          role_id,
          status,
          date_completed,
          filled_by,
          is_accessible,
        } = row;

        if (!daysMap.has(day_id)) {
          daysMap.set(day_id, {
            day_id,
            day_name,
            day_order,
            is_accessible,
            scales: [],
          });
        }

        const day = daysMap.get(day_id);

        if (scale_id) {
          day.scales.push({
            scale_id,
            scale_name,
            role_id,
            status,
            date_completed,
            filled_by,
          });
        }
      });

      schedule.days = Array.from(daysMap.values());
      schedule.days.sort((a, b) => a.day_order - b.day_order);

      return [schedule];
    } catch (error) {
      console.error("Error in getScalesForDay:", error);
      throw error;
    }
  },
};

// Function to get all schedules
// const getAllSchedules = async () => {
//   try {
//     const query = `SELECT
//     s.*,
//     u.email,
//     o.first_name,
//     o.last_name,
//     o.status AS user_status,
//     o.gender,
//     o.address,
//     o.contact_number,
//     o.date_of_birth,
//     o.stipend,
//     o.study_enrolled_id,
//     se.study_name,
//     o.ecrf_id,
//     CASE
//         WHEN s.day_id = 0 THEN "Unscheduled"
//         ELSE sd.day_name
//     END AS day_name,
//     CASE
//         WHEN s.day_id = 0 THEN "Unscheduled"
//         ELSE ss.schedule_name
//     END AS schedule_name
// FROM
//     schedule AS s
// LEFT JOIN
//     schedule_days AS sd ON s.day_id = sd.day_id
// LEFT JOIN
//     study_schedules AS ss ON sd.schedule_id = ss.schedule_id
// JOIN
//     user AS u ON s.user_id = u.user_id
// JOIN
//     organization AS o ON u.user_id = o.user_id
// JOIN
//     study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
// WHERE
//     s.disable_status = "Enable"
// ORDER BY
//     s.schedule_id DESC

// `;

//     const [result] = await db.query(query);

//     // Decrypt the encrypted fields
//     const decryptedResult = result.map((org) => {
//       try {
//         return {
//           ...org,
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//           gender: decrypt(org.gender),
//           contact_number: decrypt(org.contact_number),
//         };
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         return org;
//       }
//     });
//     return decryptedResult;
//   } catch (err) {
//     throw err;
//   }
// };

async function getOrganizationInfoForUser(userId, roleId) {
  // Check if the user has the specified role
  const [roleResult] = await db.query(
    `SELECT ur.user_id FROM user_role ur WHERE ur.user_id = ? AND ur.role_id = ?`,
    [userId, roleId]
  );

  if (roleResult.length === 0) {
    throw new Error("User does not have the specified role");
  }

  // Fetch the user's organization info (study_enrolled_id and organization_detail_id)
  const [orgInfo] = await db.query(
    `SELECT study_enrolled_id, organization_detail_id
     FROM organization
     WHERE user_id = ?`,
    [userId]
  );

  if (orgInfo.length === 0) {
    throw new Error("No organization found for this user");
  }

  return {
    studyEnrolledId: orgInfo[0].study_enrolled_id,
    organizationDetailId: orgInfo[0].organization_detail_id,
  };
}

const getAllSchedules = async (personelId) => {
  let query = `
    SELECT s.*, u.email, o.first_name, o.last_name, o.status AS user_status,
      o.gender, o.address, o.contact_number, o.date_of_birth, o.stipend, o.ecrf_id,
      o.study_enrolled_id, se.study_name,
      CASE WHEN s.day_id = 0 THEN "Unscheduled" ELSE sd.day_name END AS day_name,
      CASE WHEN s.day_id = 0 THEN "Unscheduled" ELSE ss.schedule_name END AS schedule_name
    FROM schedule AS s
    LEFT JOIN schedule_days AS sd ON s.day_id = sd.day_id
    LEFT JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
    JOIN user AS u ON s.user_id = u.user_id
    JOIN organization AS o ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
     JOIN personel_subject ps ON s.user_id = ps.subject_id
      WHERE ps.personel_id = ?
        AND s.disable_status = "Enable"
         ORDER BY o.user_id DESC, s.schedule_date ASC
  `;

  const params = [personelId];

  console.log(params, "--------==-=params----=----------");

  try {
    const [rows] = await db.query(query, params);

    const result = rows.map((schedule) => {
      try {
        return {
          ...schedule,
          schedule_date: moment(schedule.schedule_date).format("YYYY-MM-DD"),
          first_name: decrypt(schedule.first_name),
          last_name: decrypt(schedule.last_name),
          gender: decrypt(schedule.gender),
          contact_number: decrypt(schedule.contact_number),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return schedule;
      }
    });

    return result;
  } catch (err) {
    throw err;
  }
};

const getAllSchedulesFirstRecordForEachUser = async function (userId) {
  console.log("==========user id schedule==========", userId);
  // Modified query to get all schedules for the user
  let query = `
    SELECT
      s.*,
      u.email,
      o.first_name,
      o.last_name,
      o.status AS user_status,
      o.gender,
      o.address,
      o.contact_number,
      o.date_of_birth,
      o.stipend,
      o.ecrf_id,
      se.study_name,
      sd.day_name,
      ss.schedule_name,
      sd.day_order,
      sd.study_id
    FROM schedule AS s
    LEFT JOIN schedule_days AS sd ON s.day_id = sd.day_id
    LEFT JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
    JOIN user AS u ON s.user_id = u.user_id
    JOIN organization AS o ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
    LEFT JOIN personel_subject ps ON s.user_id = ps.subject_id
    WHERE s.disable_status = "Enable"
    AND ps.personel_id = ?
    ORDER BY o.user_id DESC, s.schedule_date ASC
  `;

  const params = [userId];

  try {
    const [rows] = await db.query(query, params);

    const result = rows.map((org) => {
      try {
        return {
          ...org,
          schedule_date: moment(org.schedule_date).format("YYYY-MM-DD"),
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org;
      }
    });

    // Group schedules by user and study_enrolled_id
    const grouped = result.reduce((acc, schedule) => {
      const key = `${schedule.user_id}-${schedule.study_enrolled_id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(schedule);
      return acc;
    }, {});

    // For each group, find the next schedule (first incomplete)
    const nextSchedules = [];
    for (const key in grouped) {
      const schedules = grouped[key];
      // Sort by day_order ascending to process in sequence
      schedules.sort((a, b) => a.day_order - b.day_order);
      // Find the first schedule where status is not 'Completed'
      const nextSchedule = schedules.find((s) => s.status !== "Completed");
      if (nextSchedule) {
        nextSchedules.push(nextSchedule);
      }
    }

    return nextSchedules;
  } catch (err) {
    throw err;
  }
};

// const getAllSchedulesFirstRecordForEachUser = async function (userId) {
//   console.log("==========user id schedule==========", userId);
//   // Modified query to get all schedules for specific day_ids for each user
//   let query = `
//     SELECT
//       s.*,
//       u.email,
//       o.first_name,
//       o.last_name,
//       o.status AS user_status,
//       o.gender,
//       o.address,
//       o.contact_number,
//       o.date_of_birth,
//       o.stipend,
//       o.ecrf_id,

//       se.study_name,
//       sd.day_name,
//       ss.schedule_name
//     FROM schedule AS s
//     LEFT JOIN schedule_days AS sd ON s.day_id = sd.day_id
//     LEFT JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
//     JOIN user AS u ON s.user_id = u.user_id
//     JOIN organization AS o ON u.user_id = o.user_id
//     JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
//     LEFT JOIN personel_subject ps ON s.user_id = ps.subject_id

//     WHERE s.disable_status = "Enable"
//     AND s.day_id IN (12, 21, 31,40)
//     AND ps.personel_id = ?
//     ORDER BY o.user_id DESC, s.schedule_date ASC
//   `;

//   const params = [userId];

//   try {
//     const [rows] = await db.query(query, params);

//     const result = rows.map((org) => {
//       try {
//         return {
//           ...org,
//           schedule_date: moment(org.schedule_date).format("YYYY-MM-DD"),
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//           gender: decrypt(org.gender),
//           contact_number: decrypt(org.contact_number),
//         };
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         return org;
//       }
//     });

//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

const getAllSchedulesForInvestigator = async (investigatorId) => {
  try {
    // First, fetch the investigator's details from the organization table
    const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;
    const [investigatorResult] = await db.query(investigatorQuery, [
      investigatorId,
    ]);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    const investigator = investigatorResult[0];

    // Fetch the study name from study_enrolled table
    const studyQuery = `SELECT study_name FROM study_enrolled WHERE enrolled_id = ?`;
    const [studyResult] = await db.query(studyQuery, [
      investigator.study_enrolled_id,
    ]);

    if (studyResult.length === 0) {
      throw new Error("Study not found");
    }

    const studyName = studyResult[0].study_name;

    // Fetch all schedules matching the conditions
    const schedulesQuery = `
     SELECT
    s.*,
    u.email,
    o.first_name,
    o.last_name,
    o.status AS user_status,
    o.gender,
    o.address,
    o.contact_number,
    o.date_of_birth,
    o.stipend,
    o.study_enrolled_id,
    se.study_name,
    o.notification,
    o.ecrf_id,
    CASE
        WHEN s.day_id = 0 THEN "Unscheduled"
        ELSE sd.day_name
    END AS day_name,
    CASE
        WHEN s.day_id = 0 THEN "Unscheduled"
        ELSE ss.schedule_name
    END AS schedule_name
FROM
    schedule AS s
LEFT JOIN
    schedule_days AS sd ON s.day_id = sd.day_id
LEFT JOIN
    study_schedules AS ss ON sd.schedule_id = ss.schedule_id
JOIN
    user AS u ON s.user_id = u.user_id
JOIN
    organization AS o ON u.user_id = o.user_id
JOIN
    study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
JOIN
    user_role AS ur ON u.user_id = ur.user_id
WHERE
    s.disable_status = "Enable"
    AND se.study_name = ?
    AND ur.role_id = 10
    AND o.organization_detail_id = ?
 ORDER BY o.user_id DESC, s.schedule_date ASC
`;

    const [schedulesResult] = await db.query(schedulesQuery, [
      studyName,
      investigator.organization_detail_id,
    ]);

    // Decrypt the encrypted fields
    const decryptedSchedules = schedulesResult.map((org) => {
      try {
        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org;
      }
    });

    return decryptedSchedules;
  } catch (err) {
    throw err;
  }
};

const getScheduleByIdForDelete = async (schedule_id) => {
  try {
    const query = `SELECT s.* , u.email , o.first_name , o.last_name , o.status As user_status, o.gender, o.address , o.contact_number , o.date_of_birth, o.stipend , o.study_enrolled_id,se.study_name , o.notification, o.ecrf_id FROM schedule AS s
    JOIN user as u ON s.user_id = u.user_id
    JOIN organization as o ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
    WHERE schedule_id = ?`;
    const [result] = await db.query(query, [schedule_id]);
    if (result.length > 0) {
      let org = result[0];
      try {
        org = {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
        };
        console.log(org, "--------------------");
      } catch (decryptionError) {
        // Handle decryption errors (e.g., log them)
        console.error("Decryption error:", decryptionError);
      }
      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

const getScheduleById = async (schedule_id, userId) => {
  if (Number(userId) !== Number(schedule_id)) {
    const [personelRows] = await db.query(
      `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
      [userId, schedule_id]
    );
    if (!personelRows || personelRows.length === 0) {
      const error = new Error(
        "Unauthorized: No matching record found in personel_subject"
      );
      error.statusCode = 401;
      throw error;
    }
  }

  try {
    const query = `SELECT s.* , u.email , o.first_name , o.last_name , o.status As user_status, o.gender, o.address , o.contact_number , o.date_of_birth, o.stipend , o.study_enrolled_id,se.study_name , o.notification, o.ecrf_id FROM schedule AS s
    JOIN user as u ON s.user_id = u.user_id
    JOIN organization as o ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
    WHERE schedule_id = ?`;
    const [result] = await db.query(query, [schedule_id]);
    if (result.length > 0) {
      let org = result[0];
      try {
        org = {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
        };
        console.log(org, "--------------------");
      } catch (decryptionError) {
        // Handle decryption errors (e.g., log them)
        console.error("Decryption error:", decryptionError);
      }
      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

// const ManuallyupdateSchedule = async function ({
//   schedule_id,
//   study_enrolled_id,
//   schedule_date,
//   schedule_time,
//   status,
//   note,
//   disable_status = "Enable",
//   reason = "Reschedule Schedule",
//   user_id,
//   rescheduledData,
// }) {
//   // Ensure schedule_date is in 'YYYY-MM-DD' format

//   console.log(
//     schedule_id,
//     study_enrolled_id,
//     schedule_date,
//     schedule_time,
//     status,
//     note,
//     user_id,
//     rescheduledData,
//     "==============Model============"
//   );

//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     if (status === "Rescheduled") {
//       // Cancel the current schedule
//       const cancelQuery = `
//         UPDATE schedule
//         SET status = "Cancelled"
//         WHERE schedule_id = ? AND user_id = ?
//       `;
//       await connection.execute(cancelQuery, [schedule_id, user_id]);

//       // Insert the new schedule
//       const insertQuery = `
//         INSERT INTO schedule
//           (study_enrolled_id, schedule_date, schedule_time, status, note, disable_status, reason, user_id, day_id, rescheduled)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;
//       const insertParams = [
//         study_enrolled_id,
//         schedule_date,
//         schedule_time,
//         status,
//         note,
//         disable_status,
//         reason,
//         user_id,
//         currentDayId,
//         rescheduledData ? JSON.stringify(rescheduledData) : null,
//       ];
//       const [insertResult] = await connection.execute(
//         insertQuery,
//         insertParams
//       );

//       await connection.commit();
//       return {
//         message: "Schedule rescheduled successfully.",
//         newScheduleId: insertResult.insertId,
//         cancelledScheduleId: schedule_id,
//       };
//     } else if (status === "Completed" || status === "Cancelled") {
//       let updateQuery = `
//         UPDATE schedule
//         SET schedule_date = ?,
//             schedule_time = ?,
//             status = ?,
//             note = ?
//       `;
//       let updateParams = [schedule_date, schedule_time, status, note];

//       if (rescheduledData) {
//         updateQuery += ", rescheduled = ?";
//         updateParams.push(JSON.stringify(rescheduledData));
//       }

//       updateQuery += " WHERE schedule_id = ? AND user_id = ?";
//       updateParams.push(schedule_id, user_id);

//       const [updateResult] = await connection.execute(
//         updateQuery,
//         updateParams
//       );

//       await connection.commit();
//       return {
//         message:
//           status === "Completed"
//             ? "Schedule marked as completed."
//             : "Schedule cancelled successfully.",
//         affectedRows: updateResult.affectedRows,
//       };
//     } else {
//       let updateQuery = `
//         UPDATE schedule
//         SET schedule_date = ?,
//             schedule_time = ?,
//             status = ?,
//             note = ?
//       `;
//       let updateParams = [schedule_date, schedule_time, status, note];

//       if (rescheduledData) {
//         updateQuery += ", rescheduled = ?";
//         updateParams.push(JSON.stringify(rescheduledData));
//       }

//       updateQuery += " WHERE schedule_id = ? AND user_id = ?";
//       updateParams.push(schedule_id, user_id);

//       const [updateResult] = await connection.execute(
//         updateQuery,
//         updateParams
//       );

//       await connection.commit();
//       return {
//         message: "Schedule updated successfully.",
//         affectedRows: updateResult.affectedRows,
//       };
//     }
//   } catch (err) {
//     await connection.rollback();
//     console.error("Transaction Error:", err);
//     throw err;
//   } finally {
//     connection.release();
//   }
// };
const getScheduleByIdForUpdate = async (schedule_id) => {
  try {
    const query = `SELECT s.* , u.email , o.first_name , o.last_name , o.status As user_status, o.gender, o.address , o.contact_number , o.date_of_birth, o.stipend , o.study_enrolled_id,se.study_name , o.notification, o.ecrf_id FROM schedule AS s
    JOIN user as u ON s.user_id = u.user_id
    JOIN organization as o ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
    WHERE schedule_id = ?`;
    const [result] = await db.query(query, [schedule_id]);
    if (result.length > 0) {
      let org = result[0];
      try {
        org = {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
        };
        console.log(org, "--------------------");
      } catch (decryptionError) {
        // Handle decryption errors (e.g., log them)
        console.error("Decryption error:", decryptionError);
      }
      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

const updateSchedule = async function ({
  schedule_id,
  study_enrolled_id,
  schedule_date,
  schedule_time,
  status,
  note,

  user_id,
  investigator_id,
  rescheduledData,
  auditLogHandler,
  reason = reason,
  updateEntity = "SCHEDULE",
  actionEntity = "UPDATE",
}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get the current schedule's day_id, study_id, and status first
    const [currentSchedule] = await connection.execute(
      `SELECT s.schedule_id, s.schedule_date, s.status, sd.day_id, sd.study_id, sd.day_order
       FROM schedule s
       JOIN schedule_days sd ON s.day_id = sd.day_id
       WHERE s.schedule_id = ?`,
      [schedule_id]
    );

    if (!currentSchedule.length) {
      throw new Error("Schedule not found");
    }

    // Check if the schedule is already in Completed status
    if (currentSchedule[0].status === "Completed") {
      throw new Error(
        "Cannot modify a completed schedule. Completed schedules are locked for editing."
      );
    }

    // If trying to change to Cancelled and the schedule is already Completed
    if (status === "Cancelled" && currentSchedule[0].status === "Completed") {
      throw new Error(
        "Cannot cancel a completed schedule. Completed schedules are locked for editing."
      );
    }

    // Check if the schedule is already in Cancelled status and trying to change to something else
    if (currentSchedule[0].status === "Cancelled" && status !== "Cancelled") {
      throw new Error(
        "Cannot change a cancelled schedule to another status. Cancelled schedules cannot be reverted."
      );
    }

    const { day_id } = currentSchedule[0];
    // if ([12, 21, 31].includes(day_id)) {
    //   if (status === "Completed") {
    //     await db.execute(
    //       `Update organization SET status = 'Randomized', is_randomized =1 WHERE user_id =?`,
    //       [user_id]
    //     );

    //     const params = {
    //       medication_name: "Sunobinop Or Placebo",
    //       dosage: "0.5mg or 1.0mg or 2.0mg",
    //       dosage_times: ["09:00 PM"],
    //       frequencyType: "QD",
    //       frequencyTime: "N/A",
    //       frequencyCondition: "At Bedtime",
    //       dosageType: "Tablet",
    //       allot_medicine: "1",
    //       route: "Oral",
    //       note: "Auto-created medicine",
    //       user_id: user_id,
    //       investigator_id: 0,
    //       tracker_time: new Date().toISOString(),
    //     };

    //     const medicineResult = await medicineModel.getMedicationByUserId(
    //       user_id
    //     );

    //     if (!medicineResult || medicineResult.length === 0) {
    //       if (auditLogHandler) {
    //         await auditLogHandler({
    //           action: "CREATE",
    //           entity: "Auto Create Medicine Due to Subject Screening Complete",
    //           oldValue: null,
    //           newValue: params,
    //           description: "Auto Create Medicine",
    //         });
    //       }

    //       await createMedicineLogic(params);
    //     } else {
    //       console.log(
    //         "Medicine already exists for this user, skipping creation."
    //       );
    //     }
    //   }
    // }

    // Get all future schedules for this study in order
    const [schedules] = await connection.execute(
      `SELECT s.schedule_id, s.schedule_date, sd.day_id, sd.offSet, sd.day_order
       FROM schedule s
       JOIN schedule_days sd ON s.day_id = sd.day_id
       WHERE s.user_id = ?
       AND sd.study_id = ?
       AND sd.day_order >= (
         SELECT day_order
         FROM schedule_days
         WHERE day_id = ?
       )
       ORDER BY sd.day_order`,
      [user_id, currentSchedule[0].study_id, currentSchedule[0].day_id]
    );

    // Update the current schedule
    let updateQuery = `
      UPDATE schedule
      SET schedule_date = ?,
          schedule_time = ?,
          status = ?,
          note = ?
    `;
    let updateParams = [schedule_date, schedule_time, status, note];

    if (rescheduledData) {
      updateQuery += ", rescheduled = ?";
      updateParams.push(JSON.stringify(rescheduledData));
    }

    updateQuery += " WHERE schedule_id = ? AND user_id = ?";
    updateParams.push(schedule_id, user_id);

    const [updateResult] = await connection.execute(updateQuery, updateParams);

    // Update subsequent schedules using cumulative offsets only if day_id is 13, 22, or 32
    if ([13, 22, 32].includes(day_id)) {
      let currentDate = new Date(schedule_date);
      for (let i = 1; i < schedules.length; i++) {
        const offset = schedules[i].offSet;
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + offset);

        await connection.execute(
          `UPDATE schedule
           SET schedule_date = ?
           WHERE schedule_id = ?`,
          [currentDate.toISOString().split("T")[0], schedules[i].schedule_id]
        );
      }
    }

    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
    let values2 = [
      user_id,
      investigator_id,
      schedule_id,
      updateEntity,
      actionEntity,
      reason,
    ];
    await connection.execute(reason_table, values2);

    await connection.commit();
    return {
      message:
        status === "Completed"
          ? "Schedule marked as completed."
          : "Schedule updated successfully.",
      affectedRows: updateResult.affectedRows,
    };
  } catch (err) {
    await connection.rollback();
    console.error("Transaction Error:", err);
    throw err;
  } finally {
    connection.release();
  }
};

const deleteSchedule = async (
  schedule_id,

  investigator_id,
  reason,
  user_id,
  updateEntity = "SCHEDULE",
  actionEntity = "DELETE"
) => {
  try {
    const query = `UPDATE schedule SET disable_status = "Disable" , reason = ?  WHERE schedule_id = ?`;
    const [result] = await db.query(query, [reason, schedule_id]);
    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
    let values2 = [
      user_id,
      investigator_id,
      schedule_id,
      updateEntity,
      actionEntity,
      reason,
    ];
    const recordReason = await db.query(reason_table, values2);
    return (data = { result, recordReason });
  } catch (err) {
    throw err;
  }
};

// Function to get all schedules by user ID
const getAllSchedulesByUserId = async (user_id) => {
  try {
    const query = `
      SELECT s.*, u.email, o.first_name, o.last_name, o.status AS user_status, o.gender, o.address,
      o.contact_number, o.date_of_birth, o.stipend, o.study_enrolled_id, se.study_name, o.notification
      FROM schedule AS s
      JOIN user AS u ON s.user_id = u.user_id
      JOIN organization AS o ON u.user_id = o.user_id
      JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
      WHERE s.user_id = ?`;

    const [results] = await db.query(query, [user_id]);

    if (results.length > 0) {
      let schedules = results.map((result) => {
        try {
          return {
            ...result,
            first_name: decrypt(result.first_name),
            last_name: decrypt(result.last_name),
            gender: decrypt(result.gender),
            contact_number: decrypt(result.contact_number),
          };
        } catch (decryptionError) {
          console.error("Decryption error:", decryptionError);
          return result;
        }
      });
      return schedules;
    } else {
      return [];
    }
  } catch (err) {
    throw err;
  }
};

// Function to get all future schedules for a user
const getAllFutureSchedulesForUser = async (userId) => {
  try {
    const query = `
      SELECT
        s.*,
        u.email,
        o.organization_id,
        o.first_name,
        o.middle_name,
        o.last_name,
        o.status AS user_status,
        o.gender,
        o.address,
        o.contact_number,
        o.date_of_birth,
        o.stipend,
        o.image,
        o.date_enrolled,
        o.notification,
        o.organization_detail_id,
        se.study_name,
        se.start_date AS study_start_date,
        se.end_date AS study_end_date,
        se.lower_age_limit AS study_lower_age_limit,
        se.upper_age_limit AS study_upper_age_limit,
        se.genders AS study_genders
      FROM
        schedule AS s
      JOIN
        user AS u ON s.user_id = u.user_id
      JOIN
        organization AS o ON u.user_id = o.user_id
      LEFT JOIN
        study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
      WHERE
        s.disable_status = "Enable"
        AND s.user_id = ?
        AND s.schedule_date >= CURDATE()
      ORDER BY
        s.schedule_date ASC`;

    const [result] = await db.query(query, [userId]);

    // Decrypt the encrypted fields
    const decryptedResult = result.map((row) => {
      console.log("----------------Schedule Row here-----------------");

      try {
        return {
          ...row,
          first_name: decrypt(row.first_name),
          middle_name: row.middle_name ? decrypt(row.middle_name) : null,
          last_name: decrypt(row.last_name),
          image: decrypt(row.image),
          gender: decrypt(row.gender),
          contact_number: decrypt(row.contact_number),
          address: row.address,
          date_of_birth: row.date_of_birth,
          study_enrolled_id: parseInt(row.study_enrolled_id),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return row;
      }
    });
    return decryptedResult;
  } catch (err) {
    throw err;
  }
};

// Spanish Schedule Scale Model
const SpanishscheduleScaleModel = {
  getSchedules: async () => {
    try {
      const query = "SELECT * FROM study_schedules ORDER BY order_num";
      const [results] = await db.query(query);
      return results;
    } catch (error) {
      throw error;
    }
  },

  getDaysForSchedule: async (scheduleId) => {
    try {
      const query =
        "SELECT * FROM schedule_days WHERE schedule_id = ? ORDER BY day_order";
      const [results] = await db.query(query, [scheduleId]);
      return results;
    } catch (error) {
      throw error;
    }
  },

  getScalesForDay: async (scheduleId, userId, roleId) => {
    try {
      const query = `
        SELECT DISTINCT
          spa.scale_id,
          spa.scale_name,
          spa.role_id,
          sd.day_id,
          sd.day_name,
          sd.day_order,
          ss.schedule_name,
          ss.schedule_id,
          ss.order_num,
          sds.id as schedule_day_scale_id,
          COALESCE(sss.status, 'Pending') as status,
          sss.date_completed,
          CASE
            WHEN ss.schedule_name = 'Screening' THEN true
            WHEN sss.is_accessible = 1 THEN true
            ELSE false
          END as is_accessible
        FROM spa_scale spa
        INNER JOIN schedule_day_scales sds ON spa.scale_id = sds.spa_scale_id
        INNER JOIN schedule_days sd ON sds.day_id = sd.day_id
        INNER JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
        LEFT JOIN schedule_scale_status sss ON sss.scale_id = spa.scale_id
                                            AND sss.user_id = ?
                                            AND sss.schedule_id = ss.schedule_id
                                            AND sss.day_id = sd.day_id
        WHERE ss.schedule_id = ?
        ${roleId !== 9 && roleId !== 12 ? "AND spa.role_id = ?" : ""}
        ORDER BY ss.order_num, sd.day_order, spa.scale_id
        `;

      const queryParams =
        roleId === 9 || roleId === 12
          ? [userId, scheduleId]
          : [userId, scheduleId, roleId];

      const [results] = await db.query(query, queryParams);

      console.log("Scales retrieved:", results);

      const formattedResult = {
        schedule_id: results[0] ? results[0].schedule_id : null,
        schedule_name: results[0] ? results[0].schedule_name : null,
        order_num: results[0] ? results[0].order_num : null,
        days: [],
      };

      const daysMap = new Map();

      results.forEach((row) => {
        const {
          day_id,
          day_name,
          day_order,
          scale_id,
          scale_name,
          role_id,
          status,
          date_completed,
          is_accessible,
        } = row;

        if (!daysMap.has(day_id)) {
          daysMap.set(day_id, {
            day_id,
            day_name,
            day_order,
            scales: [],
          });
        }

        const day = daysMap.get(day_id);

        day.scales.push({
          scale_id,
          scale_name,
          role_id,
          status,
          date_completed,
          is_accessible: is_accessible ? 1 : 0,
        });
      });

      formattedResult.days = Array.from(daysMap.values());
      formattedResult.days.sort((a, b) => a.day_order - b.day_order);

      return formattedResult;
    } catch (error) {
      console.error("Error in getScalesForDay:", error);
      throw error;
    }
  },
};

const RomanionScheduleScaleModel = {
  getSchedules: async () => {
    try {
      const query = "SELECT * FROM study_schedules ORDER BY order_num";
      const [results] = await db.query(query);
      return results;
    } catch (error) {
      throw error;
    }
  },

  getDaysForSchedule: async (scheduleId) => {
    try {
      const query =
        "SELECT * FROM schedule_days WHERE schedule_id = ? ORDER BY day_order";
      const [results] = await db.query(query, [scheduleId]);
      return results;
    } catch (error) {
      throw error;
    }
  },

  getScalesForDay: async (scheduleId, userId, roleId) => {
    try {
      const query = `
        SELECT DISTINCT
          rs.scale_id,
          rs.scale_name,
          rs.role_id,
          sd.day_id,
          sd.day_name,
          sd.day_order,
          ss.schedule_name,
          ss.schedule_id,
          sds.id as schedule_day_scale_id,
          COALESCE(sss.status, 'Pending') as status,
          sss.date_completed,
          CASE
            WHEN ss.schedule_name = 'Screening' THEN true
            WHEN sss.is_accessible = 1 THEN true
            ELSE false
          END as is_accessible
        FROM romanion_scale rs
        INNER JOIN schedule_day_scales sds ON rs.scale_id = sds.spa_scale_id
        INNER JOIN schedule_days sd ON sds.day_id = sd.day_id
        INNER JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
        LEFT JOIN schedule_scale_status sss ON sss.scale_id = rs.scale_id
                                            AND sss.user_id = ?
                                            AND sss.schedule_id = ss.schedule_id
                                            AND sss.day_id = sd.day_id
        WHERE
          ss.schedule_id = ?
          AND (? = 9 OR rs.role_id = ? OR rs.role_id IS NULL)
        ORDER BY sd.day_order, sds.id
      `;

      const queryParams = [userId, scheduleId, roleId, roleId];

      const [results] = await db.query(query, queryParams);
      console.log("Scales retrieved:", results);
      return results;
    } catch (error) {
      console.error("Error in getScalesForDay:", error);
      throw error;
    }
  },
};

const getScheduleByUSERId = async (id, personelId) => {
  try {
    const query2 = `SELECT user_id FROM schedule WHERE schedule_id = ?`;
    const [res2] = await db.query(query2, [id]);

    if (res2.length === 0) {
      return null;
    }

    const userId = res2[0].user_id;

    if (Number(personelId) !== Number(userId)) {
      const [personelRows] = await db.query(
        `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
        [personelId, userId]
      );
      if (!personelRows || personelRows.length === 0) {
        const error = new Error(
          "Unauthorized: No matching record found in personel_subject"
        );
        error.statusCode = 401;
        throw error;
      }
    }

    // Now, get all schedules for that user_id with DATE_FORMAT to preserve the exact date
    const query = `
      SELECT
        s.schedule_id, s.study_enrolled_id, s.user_id, s.day_id,
         CONCAT(DATE_FORMAT(s.schedule_date, '%Y-%m-%d'), 'T00:00:00.000Z') AS schedule_date,
        s.schedule_time, s.status, s.note, s.disable_status, s.reason, s.rescheduled,
        sd.day_name,
        ss.schedule_name,
        u.email,
        o.first_name,
        o.last_name,
        o.status AS user_status,
        o.gender,
        o.address,
        o.contact_number,
        o.date_of_birth,
        o.stipend,
        o.study_enrolled_id,
        se.study_name,
        o.notification,
        o.ecrf_id
      FROM schedule AS s
      JOIN user AS u ON s.user_id = u.user_id
      JOIN organization AS o ON u.user_id = o.user_id
      JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
      JOIN schedule_days AS sd ON s.day_id = sd.day_id
      JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
      WHERE s.user_id = ? AND s.disable_status = "Enable"`;

    const [result] = await db.query(query, [userId]);

    if (result.length > 0) {
      // Decrypt the relevant fields for each schedule record
      const decryptedSchedules = result.map((record) => {
        try {
          return {
            ...record,
            first_name: decrypt(record.first_name),
            last_name: decrypt(record.last_name),
            gender: decrypt(record.gender),
            contact_number: decrypt(record.contact_number),
            // No need to format the date again as we're using DATE_FORMAT in the SQL query
          };
        } catch (decryptionError) {
          console.error("Decryption error:", decryptionError);
          // Return the record as-is if decryption fails
          return record;
        }
      });

      return decryptedSchedules;
    } else {
      // No schedules found for the user
      return [];
    }
  } catch (err) {
    throw err;
  }
};
// const getScheduleByUSERId = async (id, personelId) => {
//   try {
//     const query2 = `SELECT user_id FROM schedule WHERE schedule_id = ?`;
//     const [res2] = await db.query(query2, [id]);

//     if (res2.length === 0) {
//       return null;
//     }

//     const userId = res2[0].user_id;

//     if (Number(personelId) !== Number(userId)) {
//       const [personelRows] = await db.query(
//         `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
//         [personelId, userId]
//       );
//       if (!personelRows || personelRows.length === 0) {
//         const error = new Error(
//           "Unauthorized: No matching record found in personel_subject"
//         );
//         error.statusCode = 401;
//         throw error;
//       }
//     }

//     // Now, get all schedules for that user_id
//     const query = `
//       SELECT
//         s.*,
//         sd.day_name,
//         ss.schedule_name,
//         u.email,
//         o.first_name,
//         o.last_name,
//         o.status AS user_status,
//         o.gender,
//         o.address,
//         o.contact_number,
//         o.date_of_birth,
//         o.stipend,
//         o.study_enrolled_id,
//         se.study_name,
//         o.notification,
//         o.ecrf_id
//       FROM schedule AS s
//       JOIN user AS u ON s.user_id = u.user_id
//       JOIN organization AS o ON u.user_id = o.user_id
//       JOIN study_enrolled AS se ON s.study_enrolled_id = se.enrolled_id
//       JOIN schedule_days AS sd ON s.day_id = sd.day_id
//       JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
//       WHERE  s.user_id = ? AND s.disable_status = "Enable"`;

//     const [result] = await db.query(query, [userId]);

//     if (result.length > 0) {
//       // Decrypt the relevant fields for each schedule record
//       const decryptedSchedules = result.map((record) => {
//         try {
//           return {
//             ...record,
//             first_name: decrypt(record.first_name),
//             last_name: decrypt(record.last_name),
//             gender: decrypt(record.gender),
//             contact_number: decrypt(record.contact_number),
//           };
//         } catch (decryptionError) {
//           console.error("Decryption error:", decryptionError);
//           // Return the record as-is if decryption fails
//           return record;
//         }
//       });

//       return decryptedSchedules;
//     } else {
//       // No schedules found for the user
//       return [];
//     }
//   } catch (err) {
//     throw err;
//   }
// };

module.exports = {
  createPatientSchedule: createPatientSchedule,
  getOrganizationById,
  createManualSchedule,
  getDayNameByStudyId,
  getAllSchedules: getAllSchedules,
  getAllSchedulesForInvestigator,
  getScheduleById: getScheduleById,
  getScheduleByIdForDelete,
  updateSchedule: updateSchedule,
  getScheduleByIdForUpdate,
  deleteSchedule: deleteSchedule,
  getAllSchedulesByUserId: getAllSchedulesByUserId,
  scheduleScaleModel,
  getAllFutureSchedulesForUser,
  SpanishscheduleScaleModel,
  RomanionScheduleScaleModel,
  getScheduleByUSERId,
  getAllSchedulesFirstRecordForEachUser,
};
