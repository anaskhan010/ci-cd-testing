const db = require("../../config/DBConnection3.js");
const crypto = require("crypto");

const createMedicine = async function (
  medication_name,
  dosage,
  dosage_times,
  frequencyType,
  frequencyTime,
  frequencyCondition,
  dosageType,
  allot_medicine,
  route,
  note,
  user_id,
  investigator_id,
  tracker_time,
  status = "Pending",
  disable_Status = "Enable",
  reason = "Initial Medicine"
) {
  console.log(
    "Creating medicine with the following details:",
    medication_name,
    dosage,
    dosage_times,
    frequencyType,
    frequencyTime,
    frequencyCondition,
    dosageType,
    allot_medicine,
    route,
    note,
    user_id,
    investigator_id,
    tracker_time,
    status,
    disable_Status,
    reason
  );

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const query = `INSERT INTO patientmedications
        (medication_name, dosage, frequency_type, frequency_time, frequency_condition,
        dosageType, allot_medicine, route, note, status, disable_status, reason, user_id, investigator_id, track_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const [result] = await connection.query(query, [
        medication_name,
        dosage,
        frequencyType,
        frequencyTime,
        frequencyCondition,
        dosageType,
        allot_medicine,
        route,
        note,
        status,
        disable_Status,
        reason,
        user_id,
        investigator_id,
        tracker_time,
      ]);

      const medicationId = result.insertId;
      console.log("Medicine inserted with ID:", medicationId);

      const dosageTimesData = dosage_times.map((time) => [medicationId, time]);

      const insertDosageTimesQuery = `INSERT INTO medication_dosage_times (medication_id, dosage_time) VALUES ?`;

      await connection.query(insertDosageTimesQuery, [dosageTimesData]);

      await connection.commit();
      connection.release();

      return { medicationId };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

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

var getAllMedication = async function (userId) {
  // Base query
  let query = `
    SELECT
      m.medication_id,
      DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at,
      u.user_id,
      u.email,
      m.medication_name,
      m.dosage,
      m.frequency_type,
      m.frequency_time,
      m.frequency_condition,
      m.dosageType,
      m.allot_medicine,
      m.route,
      m.note,
      o.first_name,
      o.last_name,
      o.study_enrolled_id,
      o.status,
      o.ecrf_id,
      s.study_name,
      GROUP_CONCAT(dt.dosage_time SEPARATOR ',') AS dosage_times
    FROM
      patientmedications AS m
    JOIN
      user AS u ON m.user_id = u.user_id
    JOIN
      organization AS o ON u.user_id = o.user_id
    JOIN
      study_enrolled AS s ON o.study_enrolled_id = s.enrolled_id
    LEFT JOIN
      medication_dosage_times AS dt ON m.medication_id = dt.medication_id
    JOIN (
    SELECT DISTINCT site_id, study_id, personel_id, subject_id from personel_subject  
    ) as ps on m.user_id = ps.subject_id
    
    
    WHERE
      m.disable_status = "Enable"
      AND ps.personel_id = ?

       GROUP BY
      m.medication_id,
      m.created_at,
      u.user_id,
      u.email,
      m.medication_name,
      m.dosage,
      m.frequency_type,
      m.frequency_time,
      m.frequency_condition,
      m.dosageType,
      m.allot_medicine,
      m.route,
      m.note,
      o.first_name,
      o.last_name,
      o.study_enrolled_id,
      o.status,
      o.ecrf_id,
      s.study_name
    ORDER BY
      m.created_at DESC
  `;

  // If role_id is not 9, apply the additional conditions
  let params = [userId];

  try {
    const [results] = await db.query(query, params);

    const medications = results.map((org) => {
      try {
        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          dosing_times: org.dosage_times ? org.dosage_times.split(",") : [],
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return {
          ...org,
          dosing_times: org.dosage_times ? org.dosage_times.split(",") : [],
        };
      }
    });
    return medications;
  } catch (err) {
    throw err;
  }
};

var getAllMedicationForInvestigator = async function (investigatorId) {
  try {
    const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;
    const [investigatorResult] = await db.query(investigatorQuery, [
      investigatorId,
    ]);
    console.log("chck organization", investigatorResult);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    const investigator = investigatorResult[0];

    const medicationQuery = `
      SELECT
        m.medication_id,
        m.created_at,
        u.user_id,
        u.email,
        m.medication_name,
        m.dosage,
        dt.dosage_time AS dosage_times,
        m.frequency_type,
        m.frequency_time,
        m.frequency_condition,
        m.dosageType,
        m.allot_medicine,
        m.route,
        m.note,
        o.first_name,
        o.last_name,
        o.study_enrolled_id,
        o.status,
        o.ecrf_id,
        s.study_name ,
        o.ecrf_id
      FROM
        patientmedications AS m
      JOIN
        user AS u ON m.user_id = u.user_id
      JOIN
        organization AS o ON u.user_id = o.user_id
      JOIN
        study_enrolled AS s ON FIND_IN_SET(s.enrolled_id, o.study_enrolled_id) > 0
      LEFT JOIN
        medication_dosage_times AS dt ON m.medication_id = dt.medication_id
      JOIN
        user_role AS ur ON u.user_id = ur.user_id
      WHERE
        m.disable_status = "Enable"
        AND ur.role_id = 10
        AND FIND_IN_SET(?, o.study_enrolled_id) > 0
        AND o.organization_detail_id = ${investigator.organization_detail_id}
       ORDER BY
      m.created_at DESC;
        `;

    const [medicationResult] = await db.query(medicationQuery, [
      investigator.study_enrolled_id,
    ]);

    const medications = medicationResult.map((org) => {
      try {
        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org;
      }
    });
    return medications;
  } catch (err) {
    throw err;
  }
};

var getMedicationById = async function (id) {
  console.log("id", id);
  const query = `
    SELECT
      m.medication_id,
      m.created_at,
      m.medication_name,
      m.status AS medication_status,
      m.dosage,
      md.dosage_time,
      m.frequency_type,
      m.frequency_time,
      m.frequency_condition,
      dosageType,
      m.allot_medicine,
      m.route,
      m.note,
      o.date_of_birth,
      o.gender,
      o.stipend,
      o.first_name,
      o.last_name,
      o.address,
      o.contact_number,
      o.study_enrolled_id,
      o.status ,
      o.user_id,
      u.email,
      s.study_name
    FROM patientmedications AS m
    JOIN user AS u ON m.user_id = u.user_id
    JOIN organization AS o ON u.user_id = o.user_id
    JOIN study_enrolled AS s ON o.study_enrolled_id = s.enrolled_id
    JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
    WHERE m.medication_id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    if (results.length > 0) {
      let org = results[0];
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

var getMedicationByUserId = async function (id) {
  const query = `
    SELECT m.*, md.dosage_time
    FROM patientmedications AS m
    JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
    WHERE m.user_id = ?
    `;
  try {
    const [results] = await db.query(query, [id]);
    return results;
  } catch (err) {
    throw err;
  }
};

var updateMedication = async function (
  id,
  medication_name,
  dosage,
  dosage_times,
  frequencyType,
  frequencyTime,
  frequencyCondition,
  dosageType,
  allot_medicine,
  route,
  note,
  tracker_time,
  status = "Pending",
  disable_status = "Enable",

  user_id,
  investigator_id,
  reason,
  updateEntity = "MEDICINE",
  actionEntity = "UPDATE"
) {
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const updateMedicationQuery = `
        UPDATE patientmedications SET
          medication_name = ?,
          dosage = ?,
          frequency_type = ?,
          frequency_time = ?,
          frequency_condition = ?,
          dosageType = ?,
          allot_medicine = ?,
          route = ?,
          note = ?,
          track_time = ?,
          status = ?,
          disable_status = ?,
          reason = ?
        WHERE medication_id = ?`;

      await connection.query(updateMedicationQuery, [
        medication_name,
        dosage,
        frequencyType,
        frequencyTime,
        frequencyCondition,
        dosageType,
        allot_medicine,
        route,
        note,
        tracker_time,
        status,
        disable_status,
        reason,
        id,
      ]);

      const deleteDosageTimesQuery = `
        DELETE FROM medication_dosage_times WHERE medication_id = ?`;

      await connection.query(deleteDosageTimesQuery, [id]);

      const dosageTimesData = dosage_times.map((time) => [id, time]);

      const insertDosageTimesQuery = `
        INSERT INTO medication_dosage_times (medication_id, dosage_time)
        VALUES ?`;

      await connection.query(insertDosageTimesQuery, [dosageTimesData]);

      const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
      let values2 = [
        user_id,
        investigator_id,
        id,
        updateEntity,
        actionEntity,
        reason,
      ];
      await connection.query(reason_table, values2);

      await connection.commit();
      connection.release();
      return;
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (err) {
    throw err;
  }
};

var deleteMedication = async function (
  id,
  investigator_id,
  reason,
  user_id,
  updateEntity = "MEDICINE",
  actionEntity = "DELETE"
) {
  const query =
    "UPDATE patientmedications SET disable_status = 'Disable', reason = ? WHERE medication_id = ?";
  try {
    const [result] = await db.query(query, [reason, id]);
    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
    let values2 = [
      user_id,
      investigator_id,
      id,
      updateEntity,
      actionEntity,
      reason,
    ];
    const response = await db.query(reason_table, values2);
    return (data = { result, response });
  } catch (error) {
    throw error;
  }
};

var getMedicationByUserIdForPortal = async function (id) {
  const query = `
    SELECT
      m.*,
      o.first_name,
      o.last_name,
      GROUP_CONCAT(dt.dosage_time SEPARATOR ',') AS dosage_times
    FROM
      patientmedications AS m
    JOIN
      organization AS o ON m.user_id = o.user_id
    LEFT JOIN
      medication_dosage_times AS dt ON m.medication_id = dt.medication_id
    WHERE
      m.medication_id = ?
    GROUP BY
      m.medication_id, o.first_name, o.last_name;
  `;
  try {
    const [results] = await db.query(query, [id]);
    if (results.length > 0) {
      try {
        const medications = results.map((result) => ({
          ...result,
          first_name: decrypt(result.first_name),
          last_name: decrypt(result.last_name),
          dosage_times: result.dosage_times
            ? result.dosage_times.split(",")
            : [],
        }));
        console.log(medications, "--------------------");
        return medications;
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        throw decryptionError;
      }
    } else {
      return [];
    }
  } catch (err) {
    throw err;
  }
};

const updateEmailCount = async function (medication_id, count_email) {
  const query = `UPDATE patientmedications SET count_email = ? WHERE medication_id = ?`;
  try {
    const [result] = await db.query(query, [count_email, medication_id]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getPriscribeATDate = async (user_id) => {
  const query = `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM patientmedications
    WHERE user_id = ?`;
  try {
    const [result] = await db.query(query, [user_id]);
    return result;
  } catch (err) {
    throw err;
  }
};

const checkStatus = async(user_id) => {
  const query = `SELECT status FROM organization WHERE user_id = ?`;
  try {
    const [result] = await db.query(query, [user_id]);
    return result;
  } catch (err) {
    throw err;
  }
};

const submitMedicineRecord = async (
  medicine_id,
  intake_quantity,
  user_id,
  study_id,
  date,
  time,
  reason,
  privious_date_reason = null,
  status = "Enable"
) => {
  const query = `INSERT INTO submit_medicine_records (medicine_id, intake_quantity, user_id, study_id, date, time, reason,previous_date_reason, status) VALUES (?,?,?, ?, ?, ?, ?, ?, ?)`;

  try {
    const [result] = await db.query(query, [
      medicine_id,
      intake_quantity,
      user_id,
      study_id,
      date,
      time,
      reason,
      privious_date_reason || null,
      status,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getSubmitMedicationRecordByUserId = async (userId, token_user_id) => {
  if (Number(token_user_id) !== Number(userId)) {
    const [personelRows] = await db.query(
      `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
      [token_user_id, userId]
    );
    if (!personelRows || personelRows.length === 0) {
      const error = new Error(
        "Unauthorized: No matching record found in personel_subject"
      );
      error.statusCode = 401;
      throw error;
    }
  }

  const query = `
   SELECT
      smr.record_id,
      smr.medicine_id,
      smr.intake_quantity,
      smr.user_id,
      smr.study_id,
      smr.date,
      smr.time,
      smr.reason,
      smr.previous_date_reason,
      smr.status,
      Date_FORMAT(smr.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      m.medication_name,
      m.dosage,
      mm.dosage_time,
      m.frequency_type,
      m.frequency_time,
      m.frequency_condition,
      m.dosageType,
      m.allot_medicine,
      m.route,
      st.study_name,
      o.ecrf_id

    FROM submit_medicine_records AS smr
    JOIN patientmedications AS m ON smr.medicine_id = m.medication_id
    JOIN medication_dosage_times AS mm ON m.medication_id = mm.medication_id
    JOIN organization AS o ON m.user_id = o.user_id
    JOIN study_enrolled AS st ON smr.study_id = st.enrolled_id
    WHERE smr.user_id = ? AND smr.status = 'Enable';`;

  try {
    const [results] = await db.query(query, [userId]);

    return results;
  } catch (err) {
    console.error("Error in getSubmitMedicationRecordByUserId:", err);
    throw err;
  }
};

const disbaleMedicineRecord = async (
  record_id,
  user_id,
  investigatorId,
  medicineId,
  reason,
  updateEntity = "MEDICINE_INTAKE",
  actionEntity = "DELETE"
) => {
  const query = `Update submit_medicine_records SET status = 'Disable' WHERE record_id =?`;
  const [result] = await db.query(query, [record_id]);
  const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
  let values2 = [
    user_id,
    investigatorId,
    record_id,
    updateEntity,
    actionEntity,
    reason,
  ];
  const deleteRecord = await db.query(reason_table, values2);

  return (data = { result, deleteRecord });
};


const checkMedicineComment = async (record_id) => {
  const query = `SELECT COUNT(*) as commentCount FROM medicine_comments WHERE record_id = ?`;
  const [result] = await db.query(query, [record_id]);
  
  return result[0].commentCount > 0;
};




const getQuestionsAndOptions = async () => {
  const query = `
    SELECT
      q.que_id AS question_id,
      q.question_text,
      o.option_id,
      o.option_text
    FROM
      medicine_question q
    LEFT JOIN
      medicine_question_options o
    ON
      q.que_id = o.question_id
    ORDER BY
      q.que_id, o.option_id;
  `;
  try {
    const [results] = await db.query(query);
    const questionsMap = {};

    results.forEach((row) => {
      const { question_id, question_text, option_id, option_text } = row;

      if (!questionsMap[question_id]) {
        questionsMap[question_id] = {
          id: question_id,
          question_text: question_text,
          options: [],
        };
      }

      if (option_id) {
        questionsMap[question_id].options.push({
          id: option_id,
          option_text: option_text,
        });
      }
    });

    const questions = Object.values(questionsMap);
    return questions;
  } catch (err) {
    throw err;
  }
};

const submitmedicineResponseModel = async (responsesData) => {
  console.log(responsesData, "response data");
  const query = `
    INSERT INTO medicine_question_response (question_id, response_text, medicine_id, submit_date)
    VALUES ?
  `;

  const values = responsesData.map((response) => [
    response.question_id,
    response.response_text,
    response.medicine_id,
    response.submit_date,
  ]);

  try {
    const [result] = await db.query(query, [values]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getMedicationsWithDosageTimes = async () => {
  const query = `
     SELECT
      pm.medication_id,
      pm.medication_name,
      mdt.dosage_time,
      pm.user_id,
      u.email,
      o.is_randomized,
      o.status,
      o.first_name,
      o.last_name
    FROM patientmedications pm
    JOIN medication_dosage_times mdt ON pm.medication_id = mdt.medication_id
    JOIN user u ON pm.user_id = u.user_id
    JOIN organization o ON u.user_id = o.user_id
    WHERE
      pm.status = 'Pending'
      AND pm.disable_status = 'Enable'
  `;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    throw error;
  }
};

const getPatientsWhoMissedAndNotNotified = async () => {
  const query = `
    SELECT
      o.ecrf_id,
      o.first_name,
      o.last_name,
      o.study_enrolled_id,
      u.email,
      u.user_id,
      o.status,
      EXISTS (
        SELECT 1
        FROM patientmedications pm
        WHERE pm.user_id = u.user_id
      ) AS in_patientmedications,
      (o.user_id IS NOT NULL) AS user_in_organization
    FROM user u
    LEFT JOIN organization o
      ON o.user_id = u.user_id
    JOIN user_role ur
      ON u.user_id = ur.user_id
    JOIN role r
      ON ur.role_id = r.role_id
    JOIN patient_account_status pas
      ON pas.user_id = u.user_id
      AND pas.account_status = 'Accepted'
    WHERE
      r.role_name = 'Subject'
      -- Condition: not taken meds in the last 24 hours
      AND NOT EXISTS (
        SELECT 1 FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
          AND STR_TO_DATE(CONCAT(smr.date, ' ', smr.time), '%Y-%m-%d %H:%i:%s')
              >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      )
      -- Condition: a valid schedule exists
      AND EXISTS (
        SELECT 1
        FROM schedule s
        JOIN schedule_days sd ON s.day_id = sd.day_id
        JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
        WHERE s.user_id = u.user_id
          AND ss.schedule_id = 2
          AND s.schedule_date <= CURRENT_DATE()
      )
      -- NEW Condition: ensure we have NOT already flagged them
      AND NOT EXISTS (
        SELECT 1
        FROM user_missed_medication_log umml
        WHERE umml.user_id = u.user_id
          AND umml.resolved_time IS NULL
      )
    ;
  `;

  try {
    const [result] = await db.query(query);
    return result;
  } catch (err) {
    throw err;
  }
};

const getMedicationName = async (user_id) => {
  const query = `
    SELECT pm.medication_name
    FROM patientmedications pm
    WHERE pm.user_id = ?
    LIMIT 1
  `;
  try {
    const [results] = await db.query(query, [user_id]);
    if (results.length > 0) {
      return results[0].medication_name;
    } else {
      return "Unknown Medication";
    }
  } catch (err) {
    throw err;
  }
};

const checkOverdose = async (medicine_id, intake_quantity, user_id) => {
  const query = `
    SELECT allot_medicine FROM patientmedications
    WHERE user_id = ? AND medication_id = ? LIMIT 1
  `;

  try {
    const [rows] = await db.query(query, [user_id, medicine_id]);

    if (rows.length > 0) {
      const allot_medicine = rows[0].allot_medicine;
      return intake_quantity > allot_medicine;
    } else {
      console.error("Patient medication data not found");
      return false;
    }
  } catch (err) {
    console.error("Error in checkOverdose:", err);
    throw err;
  }
};

const getPatientData = async (user_id) => {
  const query = `
    SELECT study_enrolled_id, ecrf_id, organization_detail_id FROM organization WHERE user_id = ? LIMIT 1
  `;

  try {
    const [rows] = await db.query(query, [user_id]);
    if (rows.length > 0) {
      return rows[0];
    } else {
      console.error("Patient data not found in organization table");
      return null;
    }
  } catch (err) {
    console.error("Error in getPatientData:", err);
    throw err;
  }
};

const getRecipients = async (study_enrolled_id, organization_detail_id) => {
  try {
    const subjectRoleQuery = `
      SELECT role_id FROM role WHERE role_name = 'subject' LIMIT 1
    `;
    const [subjectRoleRows] = await db.query(subjectRoleQuery);

    const subjectRoleId = subjectRoleRows[0]?.role_id;
    if (!subjectRoleId) {
      console.error("Subject role not found");
      return [];
    }

    const recipientsQuery = `
      SELECT u.user_id, u.email, o.first_name, o.last_name, o.study_enrolled_id
      FROM user u
      JOIN user_role ur ON u.user_id = ur.user_id
      JOIN role r ON ur.role_id = r.role_id
      JOIN organization o ON u.user_id = o.user_id
      WHERE o.study_enrolled_id = ?
        AND r.role_id != ? AND o.organization_detail_id = ?
    `;
    const [recipientsRows] = await db.query(recipientsQuery, [
      study_enrolled_id,
      subjectRoleId,
      organization_detail_id,
    ]);

    const recipients = recipientsRows.map((row) => ({
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
    }));

    return recipients;
  } catch (err) {
    console.error("Error in getRecipients:", err);
    throw err;
  }
};

const insertMissedMedicationLog = async (userId) => {
  const query = `
    INSERT INTO user_missed_medication_log (user_id, email_sent_time)
    VALUES (?, NOW())
  `;
  try {
    const [result] = await db.query(query, [userId]);
    return result;
  } catch (err) {
    throw err;
  }
};
const getUsersToNotify = async (timezone) => {
  const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
       WHERE email_type_id = 9
      GROUP BY personel_id
      HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;

  const query = `
    SELECT u.user_id, u.email, o.first_name, o.last_name, o.timezone, o.ecrf_id, pass.study_id, pass.site_id, r.role_id
    FROM user u
    JOIN user_role ur ON u.user_id = ur.user_id
    JOIN role r ON ur.role_id = r.role_id
    JOIN organization o ON u.user_id = o.user_id
    JOIN personnel_assigned_sites_studies as pass on u.user_id = pass.personnel_id
    JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
    WHERE r.role_name != 'Subject'
  `;
  try {
    const [results] = await db.query(query);
    const filteredResult = results.filter((r) => r.timezone === timezone);
    console.log("============================================");
    console.log("filtered patients based on timezone");
    console.log(filteredResult);
    console.log("============================================");
    return filteredResult;
  } catch (err) {
    throw err;
  }
};
async function getSubjectsWhoHaveNotSubmittedInLast24Hours() {
  const query = `
    SELECT
      u.user_id,
      u.email,
      o.ecrf_id,
      o.study_enrolled_id,
      o.status,
      o.first_name,
      o.last_name,
      o.organization_detail_id,
      o.timezone,
      CONVERT_TZ(
        CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
        o.timezone, 'UTC'
      ) AS window_start_utc,
      CONVERT_TZ(
        CONCAT(DATE(NOW()), ' 08:00:00'),
        o.timezone, 'UTC'
      ) AS window_end_utc,
      (
        SELECT smr.created_at
        FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
        ORDER BY smr.created_at DESC
        LIMIT 1
      ) AS last_submission_time,
      TIMESTAMPDIFF(
        HOUR,
        (
          SELECT smr2.created_at
          FROM submit_medicine_records smr2
          WHERE smr2.user_id = u.user_id
          ORDER BY smr2.created_at DESC
          LIMIT 1
        ),
        NOW()
      ) AS hours_since_last_submission
    FROM user u
    JOIN user_role ur ON u.user_id = ur.user_id
    JOIN role r ON ur.role_id = r.role_id
    JOIN organization o ON u.user_id = o.user_id
    JOIN patient_account_status pas on pas.user_id = u.user_id AND pas.account_status = "Accepted"
    WHERE
      r.role_name = 'Subject'
      AND o.status = 'Randomized'
      AND o.status != 'Safety Follow-up'
      AND NOT EXISTS (
        SELECT 1
        FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
          AND smr.created_at >= CONVERT_TZ(
            CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
            o.timezone, 'UTC'
          )
          AND smr.created_at < CONVERT_TZ(
            CONCAT(DATE(NOW()), ' 08:00:00'),
            o.timezone, 'UTC'
          )
      )
  `;

  try {
    const [rows] = await db.query(query);
    return rows;
  } catch (error) {
    throw error;
  }
}

// async function getSubjectsWhoHaveNotSubmittedInLast24Hours() {
//   const query = `
//     SELECT
//       u.user_id,
//       u.email,
//       o.ecrf_id,
//       o.study_enrolled_id,
//       o.status,
//       o.first_name,
//       o.last_name,
//       o.organization_detail_id,
//       o.timezone,
//       CONVERT_TZ(
//         CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//         o.timezone, 'UTC'
//       ) AS window_start_utc,
//       CONVERT_TZ(
//         CONCAT(DATE(NOW()), ' 08:00:00'),
//         o.timezone, 'UTC'
//       ) AS window_end_utc,
//       (
//         SELECT smr.created_at
//         FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//         ORDER BY smr.created_at DESC
//         LIMIT 1
//       ) AS last_submission_time,
//       TIMESTAMPDIFF(
//         HOUR,
//         (
//           SELECT smr2.created_at
//           FROM submit_medicine_records smr2
//           WHERE smr2.user_id = u.user_id
//           ORDER BY smr2.created_at DESC
//           LIMIT 1
//         ),
//         NOW()
//       ) AS hours_since_last_submission
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     JOIN patient_account_status pas on pas.user_id = u.user_id AND pas.account_status = "Accepted"
//     WHERE
//       r.role_name = 'Subject'
//       AND o.status = 'Randomized'
//       AND NOT EXISTS (
//         SELECT 1
//         FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//           AND smr.created_at >= CONVERT_TZ(
//             CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//             o.timezone, 'UTC'
//           )
//           AND smr.created_at < CONVERT_TZ(
//             CONCAT(DATE(NOW()), ' 08:00:00'),
//             o.timezone, 'UTC'
//           )
//       )
//   `;

//   try {
//     const [rows] = await db.query(query);
//     return rows;
//   } catch (error) {
//     throw error;
//   }
// }

// const getUsersToNotify = async () => {
//   const query = `
//     SELECT
//       u.email,
//       o.first_name,
//       o.last_name,
//       o.ecrf_id,
//       o.study_enrolled_id,
//       o.organization_detail_id,
//       ur.role_id
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     WHERE r.role_name != 'Subject'
//   `;

//   try {
//     const [results] = await db.query(query);
//     return results;
//   } catch (err) {
//     throw err;
//   }
// };

module.exports = {
  createMedicine,
  getAllMedication,
  getAllMedicationForInvestigator,
  getMedicationById,
  getMedicationByUserId,
  updateMedication,
  deleteMedication,
  getMedicationByUserIdForPortal,
  updateEmailCount,
  submitMedicineRecord,
  getQuestionsAndOptions,
  submitmedicineResponseModel,
  getSubmitMedicationRecordByUserId,
  getMedicationsWithDosageTimes,
  getPatientsWhoMissedAndNotNotified,
  getMedicationName,
  getUsersToNotify,
  checkOverdose,
  getRecipients,
  getPatientData,
  insertMissedMedicationLog,
  getSubjectsWhoHaveNotSubmittedInLast24Hours,
  disbaleMedicineRecord,
  getOrganizationById,
  getPriscribeATDate,
  checkMedicineComment,
  checkStatus
};


// const db = require("../../config/DBConnection3.js");
// const crypto = require("crypto");

// const createMedicine = async function (
//   medication_name,
//   dosage,
//   dosage_times,
//   frequencyType,
//   frequencyTime,
//   frequencyCondition,
//   dosageType,
//   allot_medicine,
//   route,
//   note,
//   user_id,
//   investigator_id,
//   tracker_time,
//   status = "Pending",
//   disable_Status = "Enable",
//   reason = "Initial Medicine"
// ) {
//   console.log(
//     "Creating medicine with the following details:",
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     user_id,
//     investigator_id,
//     tracker_time,
//     status,
//     disable_Status,
//     reason
//   );

//   try {
//     const connection = await db.getConnection();
//     try {
//       await connection.beginTransaction();

//       const query = `INSERT INTO patientmedications 
//         (medication_name, dosage, frequency_type, frequency_time, frequency_condition, 
//         dosageType, allot_medicine, route, note, status, disable_status, reason, user_id, investigator_id, track_time) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//       const [result] = await connection.query(query, [
//         medication_name,
//         dosage,
//         frequencyType,
//         frequencyTime,
//         frequencyCondition,
//         dosageType,
//         allot_medicine,
//         route,
//         note,
//         status,
//         disable_Status,
//         reason,
//         user_id,
//         investigator_id,
//         tracker_time,
//       ]);

//       const medicationId = result.insertId;
//       console.log("Medicine inserted with ID:", medicationId);

//       const dosageTimesData = dosage_times.map((time) => [medicationId, time]);

//       const insertDosageTimesQuery = `INSERT INTO medication_dosage_times (medication_id, dosage_time) VALUES ?`;

//       await connection.query(insertDosageTimesQuery, [dosageTimesData]);

//       await connection.commit();
//       connection.release();

//       return { medicationId };
//     } catch (error) {
//       await connection.rollback();
//       connection.release();
//       throw error;
//     }
//   } catch (error) {
//     throw error;
//   }
// };

// const ENCRYPTION_KEY = Buffer.from(
//   "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
//   "base64"
// );
// const IV_LENGTH = 16;

// function decrypt(text) {
//   if (!text) return text;
//   let textParts = text.split(":");
//   let iv = Buffer.from(textParts.shift(), "hex");
//   let encryptedText = Buffer.from(textParts.join(":"), "hex");
//   let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
//   let decrypted = decipher.update(encryptedText, "hex", "utf8");
//   decrypted += decipher.final("utf8");
//   return decrypted;
// }

// var getAllMedication = async function (userId) {
//   // Base query
//   let query = `
//     SELECT  
//       m.medication_id,
//       m.created_at,
//       u.user_id,
//       u.email,
//       m.medication_name,
//       m.dosage,
//       m.frequency_type,
//       m.frequency_time,
//       m.frequency_condition,
//       m.dosageType,
//       m.allot_medicine,
//       m.route,
//       m.note,
//       o.first_name,
//       o.last_name,
//       o.study_enrolled_id,
//       o.status,
//       o.ecrf_id,
//       s.study_name,
//       GROUP_CONCAT(dt.dosage_time SEPARATOR ',') AS dosage_times
//     FROM 
//       patientmedications AS m
//     JOIN 
//       user AS u ON m.user_id = u.user_id
//     JOIN 
//       organization AS o ON u.user_id = o.user_id
//     JOIN 
//       study_enrolled AS s ON o.study_enrolled_id = s.enrolled_id
//     LEFT JOIN 
//       medication_dosage_times AS dt ON m.medication_id = dt.medication_id
//     JOIN personel_subject ps ON m.user_id = ps.subject_id
//     WHERE 
//       m.disable_status = "Enable"
//       AND ps.personel_id = ?

//       GROUP BY 
//       m.medication_id,
//       m.created_at,
//       u.user_id,
//       u.email,
//       m.medication_name,
//       m.dosage,
//       m.frequency_type,
//       m.frequency_time,
//       m.frequency_condition,
//       m.dosageType,
//       m.allot_medicine,
//       m.route,
//       m.note,
//       o.first_name,
//       o.last_name,
//       o.study_enrolled_id,
//       o.status,
//       o.ecrf_id,
//       s.study_name
//     ORDER BY 
//       m.created_at DESC;
//   `;

//   // If role_id is not 9, apply the additional conditions
//   let params = [userId];

//   try {
//     const [results] = await db.query(query, params);

//     const medications = results.map((org) => {
//       try {
//         return {
//           ...org,
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//           dosing_times: org.dosage_times ? org.dosage_times.split(",") : [],
//         };
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         return {
//           ...org,
//           dosing_times: org.dosage_times ? org.dosage_times.split(",") : [],
//         };
//       }
//     });
//     return medications;
//   } catch (err) {
//     throw err;
//   }
// };

// var getAllMedicationForInvestigator = async function (investigatorId) {
//   try {
//     const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;
//     const [investigatorResult] = await db.query(investigatorQuery, [
//       investigatorId,
//     ]);
//     console.log("chck organization", investigatorResult);

//     if (investigatorResult.length === 0) {
//       throw new Error("Investigator not found");
//     }

//     const investigator = investigatorResult[0];

//     const medicationQuery = `
//       SELECT 
//         m.medication_id, 
//         m.created_at,
//         u.user_id, 
//         u.email, 
//         m.medication_name, 
//         m.dosage, 
//         dt.dosage_time AS dosage_times, 
//         m.frequency_type, 
//         m.frequency_time, 
//         m.frequency_condition,
//         m.dosageType, 
//         m.allot_medicine,
//         m.route,
//         m.note,
//         o.first_name,
//         o.last_name, 
//         o.study_enrolled_id, 
//         o.status, 
//         o.ecrf_id,
//         s.study_name ,
//         o.ecrf_id
//       FROM 
//         patientmedications AS m 
//       JOIN 
//         user AS u ON m.user_id = u.user_id 
//       JOIN 
//         organization AS o ON u.user_id = o.user_id
//       JOIN 
//         study_enrolled AS s ON FIND_IN_SET(s.enrolled_id, o.study_enrolled_id) > 0
//       LEFT JOIN 
//         medication_dosage_times AS dt ON m.medication_id = dt.medication_id
//       JOIN
//         user_role AS ur ON u.user_id = ur.user_id
//       WHERE 
//         m.disable_status = "Enable"
//         AND ur.role_id = 10
//         AND FIND_IN_SET(?, o.study_enrolled_id) > 0
//         AND o.organization_detail_id = ${investigator.organization_detail_id}
//       ORDER BY 
//       m.created_at DESC; 
//         `;

//     const [medicationResult] = await db.query(medicationQuery, [
//       investigator.study_enrolled_id,
//     ]);

//     const medications = medicationResult.map((org) => {
//       try {
//         return {
//           ...org,
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//         };
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         return org;
//       }
//     });
//     return medications;
//   } catch (err) {
//     throw err;
//   }
// };

// var getMedicationById = async function (id) {
//   console.log("id", id);
//   const query = `
//     SELECT 
//       m.medication_id,
//       m.created_at, 
//       m.medication_name,
//       m.status AS medication_status, 
//       m.dosage,
//       md.dosage_time, 
//       m.frequency_type, 
//       m.frequency_time, 
//       m.frequency_condition, 
//       dosageType,
//       m.allot_medicine,
//       m.route,  
//       m.note,
//       o.date_of_birth, 
//       o.gender,
//       o.stipend,
//       o.first_name,
//       o.last_name,
//       o.address,
//       o.contact_number, 
//       o.study_enrolled_id, 
//       o.status ,
//       o.user_id, 
//       u.email,
//       s.study_name  
//     FROM patientmedications AS m 
//     JOIN user AS u ON m.user_id = u.user_id 
//     JOIN organization AS o ON u.user_id = o.user_id
//     JOIN study_enrolled AS s ON o.study_enrolled_id = s.enrolled_id
//     JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
//     WHERE m.medication_id = ?`;
//   try {
//     const [results] = await db.query(query, [id]);
//     if (results.length > 0) {
//       let org = results[0];
//       try {
//         org = {
//           ...org,
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//           gender: decrypt(org.gender),
//           contact_number: decrypt(org.contact_number),
//         };
//         console.log(org, "--------------------");
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//       }
//       return org;
//     } else {
//       return null;
//     }
//   } catch (err) {
//     throw err;
//   }
// };

// const getOrganizationById = async (user_id) => {
//   try {
//     const [result] = await db.query(
//       `
//       SELECT o.*, u.email,
//       org.organization_name, org.organization_address, notes.note,
//       GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
//       GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
//       GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
//       GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
//       GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
//       FROM organization AS o
//       JOIN user AS u ON o.user_id = u.user_id
//       JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
//       LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
//       LEFT JOIN (
//         SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id
//         FROM organization AS inv_org
//         JOIN user_role AS r ON inv_org.user_id = r.user_id
//         WHERE r.role_id = 12
//       ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
//       JOIN (
//         SELECT user_id, MAX(note) AS note
//         FROM note
//         GROUP BY user_id
//       ) AS notes ON u.user_id = notes.user_id
//       WHERE o.user_id = ?
//       GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
//               org.organization_name, org.organization_address, notes.note
//       `,
//       [user_id]
//     );

//     if (result.length > 0) {
//       let org = result[0];

//       try {
//         const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
//         const studyNames = org.study_names ? org.study_names.split(",") : [];
//         const investigatorUserIds = org.investigator_user_ids
//           ? org.investigator_user_ids.split(",")
//           : [];
//         const investigatorFirstNames = org.investigator_first_names
//           ? org.investigator_first_names.split(",")
//           : [];
//         const investigatorLastNames = org.investigator_last_names
//           ? org.investigator_last_names.split(",")
//           : [];

//         // Decrypt investigator first and last names individually
//         const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
//           user_id: parseInt(id),
//           first_name: decrypt(investigatorFirstNames[index] || ""),
//           last_name: decrypt(investigatorLastNames[index] || ""),
//         }));

//         org = {
//           ...org,
//           first_name: decrypt(org.first_name),
//           middle_name: decrypt(org.middle_name),
//           last_name: decrypt(org.last_name),
//           gender: decrypt(org.gender),
//           contact_number: decrypt(org.contact_number),
//           image: org.image ? decrypt(org.image) : null,
//           study_enrolled: enrolledIds.map((id, index) => ({
//             id: parseInt(id),
//             name: studyNames[index] || "",
//           })),
//           investigators: decryptedInvestigators,
//         };

//         // Remove raw investigator_first_names and investigator_last_names from the result
//         delete org.investigator_first_names;
//         delete org.investigator_last_names;
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//       }

//       return org;
//     } else {
//       return null;
//     }
//   } catch (err) {
//     throw err;
//   }
// };

// var getMedicationByUserId = async function (id) {
//   const query = `
//     SELECT m.*, md.dosage_time
//     FROM patientmedications AS m
//     JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
//     WHERE m.user_id = ?
//     `;
//   try {
//     const [results] = await db.query(query, [id]);
//     return results;
//   } catch (err) {
//     throw err;
//   }
// };

// var updateMedication = async function (
//   id,
//   medication_name,
//   dosage,
//   dosage_times,
//   frequencyType,
//   frequencyTime,
//   frequencyCondition,
//   dosageType,
//   allot_medicine,
//   route,
//   note,
//   tracker_time,
//   status = "Pending",
//   disable_status = "Enable",

//   user_id,
//   investigator_id,
//   reason,
//   updateEntity = "MEDICINE",
//   actionEntity = "UPDATE"
// ) {
//   try {
//     const connection = await db.getConnection();
//     try {
//       await connection.beginTransaction();

//       const updateMedicationQuery = `
//         UPDATE patientmedications SET
//           medication_name = ?,
//           dosage = ?,
//           frequency_type = ?,
//           frequency_time = ?,
//           frequency_condition = ?,
//           dosageType = ?,
//           allot_medicine = ?,
//           route = ?,
//           note = ?,
//           track_time = ?,
//           status = ?,
//           disable_status = ?,
//           reason = ?
//         WHERE medication_id = ?`;

//       await connection.query(updateMedicationQuery, [
//         medication_name,
//         dosage,
//         frequencyType,
//         frequencyTime,
//         frequencyCondition,
//         dosageType,
//         allot_medicine,
//         route,
//         note,
//         tracker_time,
//         status,
//         disable_status,
//         reason,
//         id,
//       ]);

//       const deleteDosageTimesQuery = `
//         DELETE FROM medication_dosage_times WHERE medication_id = ?`;

//       await connection.query(deleteDosageTimesQuery, [id]);

//       const dosageTimesData = dosage_times.map((time) => [id, time]);

//       const insertDosageTimesQuery = `
//         INSERT INTO medication_dosage_times (medication_id, dosage_time)
//         VALUES ?`;

//       await connection.query(insertDosageTimesQuery, [dosageTimesData]);

//       const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
//       let values2 = [
//         user_id,
//         investigator_id,
//         id,
//         updateEntity,
//         actionEntity,
//         reason,
//       ];
//       await connection.query(reason_table, values2);

//       await connection.commit();
//       connection.release();
//       return;
//     } catch (error) {
//       await connection.rollback();
//       connection.release();
//       throw error;
//     }
//   } catch (err) {
//     throw err;
//   }
// };

// var deleteMedication = async function (
//   id,
//   investigator_id,
//   reason,
//   user_id,
//   updateEntity = "MEDICINE",
//   actionEntity = "DELETE"
// ) {
//   const query =
//     "UPDATE patientmedications SET disable_status = 'Disable', reason = ? WHERE medication_id = ?";
//   try {
//     const [result] = await db.query(query, [reason, id]);
//     const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
//     let values2 = [
//       user_id,
//       investigator_id,
//       id,
//       updateEntity,
//       actionEntity,
//       reason,
//     ];
//     const response = await db.query(reason_table, values2);
//     return (data = { result, response });
//   } catch (error) {
//     throw error;
//   }
// };

// var getMedicationByUserIdForPortal = async function (id) {
//   const query = `
//     SELECT 
//       m.*, 
//       o.first_name, 
//       o.last_name,
//       GROUP_CONCAT(dt.dosage_time SEPARATOR ',') AS dosage_times
//     FROM 
//       patientmedications AS m
//     JOIN 
//       organization AS o ON m.user_id = o.user_id
//     LEFT JOIN 
//       medication_dosage_times AS dt ON m.medication_id = dt.medication_id
//     WHERE 
//       m.medication_id = ?
//     GROUP BY 
//       m.medication_id, o.first_name, o.last_name;
//   `;
//   try {
//     const [results] = await db.query(query, [id]);
//     if (results.length > 0) {
//       try {
//         const medications = results.map((result) => ({
//           ...result,
//           first_name: decrypt(result.first_name),
//           last_name: decrypt(result.last_name),
//           dosage_times: result.dosage_times
//             ? result.dosage_times.split(",")
//             : [],
//         }));
//         console.log(medications, "--------------------");
//         return medications;
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         throw decryptionError;
//       }
//     } else {
//       return [];
//     }
//   } catch (err) {
//     throw err;
//   }
// };

// const updateEmailCount = async function (medication_id, count_email) {
//   const query = `UPDATE patientmedications SET count_email = ? WHERE medication_id = ?`;
//   try {
//     const [result] = await db.query(query, [count_email, medication_id]);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

// const getPriscribeATDate = async (user_id) => {
//   const query = `SELECT created_at FROM patientmedications WHERE user_id =?`;
//   try {
//     const [result] = await db.query(query, [user_id]);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

// const submitMedicineRecord = async (
//   medicine_id,
//   intake_quantity,
//   user_id,
//   study_id,
//   date,
//   time,
//   reason,
//   privious_date_reason = null,
//   status = "Enable"
// ) => {
//   const query = `INSERT INTO submit_medicine_records (medicine_id, intake_quantity, user_id, study_id, date, time, reason,previous_date_reason, status) VALUES (?,?,?, ?, ?, ?, ?, ?, ?)`;

//   try {
//     const [result] = await db.query(query, [
//       medicine_id,
//       intake_quantity,
//       user_id,
//       study_id,
//       date,
//       time,
//       reason,
//       privious_date_reason || null,
//       status,
//     ]);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

// const getSubmitMedicationRecordByUserId = async (userId, token_user_id) => {
//   if (Number(token_user_id) !== Number(userId)) {
//     const [personelRows] = await db.query(
//       `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
//       [token_user_id, userId]
//     );
//     if (!personelRows || personelRows.length === 0) {
//       const error = new Error(
//         "Unauthorized: No matching record found in personel_subject"
//       );
//       error.statusCode = 401;
//       throw error;
//     }
//   }

//   const query = `
//   SELECT 
//       smr.*,
//       m.medication_name,
//       m.dosage,
//       mm.dosage_time,
//       m.frequency_type,
//       m.frequency_time,
//       m.frequency_condition,
//       m.dosageType,
//       m.allot_medicine,
//       m.route,
//       st.study_name,
//       o.ecrf_id
     
//     FROM submit_medicine_records AS smr
//     JOIN patientmedications AS m ON smr.medicine_id = m.medication_id
//     JOIN medication_dosage_times AS mm ON m.medication_id = mm.medication_id
//     JOIN organization AS o ON m.user_id = o.user_id
//     JOIN study_enrolled AS st ON smr.study_id = st.enrolled_id
//     WHERE smr.user_id = ? AND smr.status = 'Enable';`;

//   try {
//     const [results] = await db.query(query, [userId]);

//     return results;
//   } catch (err) {
//     console.error("Error in getSubmitMedicationRecordByUserId:", err);
//     throw err;
//   }
// };

// const disbaleMedicineRecord = async (
//   record_id,
//   user_id,
//   investigatorId,
//   medicineId,
//   reason,
//   updateEntity = "MEDICINE_INTAKE",
//   actionEntity = "DELETE"
// ) => {
//   const query = `Update submit_medicine_records SET status = 'Disable' WHERE record_id =?`;
//   const [result] = await db.query(query, [record_id]);
//   const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
//   let values2 = [
//     user_id,
//     investigatorId,
//     medicineId,
//     updateEntity,
//     actionEntity,
//     reason,
//   ];
//   const deleteRecord = await db.query(reason_table, values2);

//   return (data = { result, deleteRecord });
// };

// const getQuestionsAndOptions = async () => {
//   const query = `
//     SELECT 
//       q.que_id AS question_id,
//       q.question_text, 
//       o.option_id, 
//       o.option_text
//     FROM 
//       medicine_question q
//     LEFT JOIN 
//       medicine_question_options o 
//     ON 
//       q.que_id = o.question_id
//     ORDER BY 
//       q.que_id, o.option_id;
//   `;
//   try {
//     const [results] = await db.query(query);
//     const questionsMap = {};

//     results.forEach((row) => {
//       const { question_id, question_text, option_id, option_text } = row;

//       if (!questionsMap[question_id]) {
//         questionsMap[question_id] = {
//           id: question_id,
//           question_text: question_text,
//           options: [],
//         };
//       }

//       if (option_id) {
//         questionsMap[question_id].options.push({
//           id: option_id,
//           option_text: option_text,
//         });
//       }
//     });

//     const questions = Object.values(questionsMap);
//     return questions;
//   } catch (err) {
//     throw err;
//   }
// };

// const submitmedicineResponseModel = async (responsesData) => {
//   console.log(responsesData, "response data");
//   const query = `
//     INSERT INTO medicine_question_response (question_id, response_text, medicine_id, submit_date) 
//     VALUES ?
//   `;

//   const values = responsesData.map((response) => [
//     response.question_id,
//     response.response_text,
//     response.medicine_id,
//     response.submit_date,
//   ]);

//   try {
//     const [result] = await db.query(query, [values]);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

// const getMedicationsWithDosageTimes = async () => {
//   const query = `
//      SELECT 
//       pm.medication_id, 
//       pm.medication_name, 
//       mdt.dosage_time, 
//       pm.user_id,
//       u.email,
//       o.is_randomized,
//       o.status,
//       o.first_name,
//       o.last_name
//     FROM patientmedications pm
//     JOIN medication_dosage_times mdt ON pm.medication_id = mdt.medication_id
//     JOIN user u ON pm.user_id = u.user_id
//     JOIN organization o ON u.user_id = o.user_id
//     WHERE 
//       pm.status = 'Pending' 
//       AND pm.disable_status = 'Enable'
//   `;
//   try {
//     const [results] = await db.query(query);
//     return results;
//   } catch (error) {
//     throw error;
//   }
// };

// const getPatientsWhoMissedAndNotNotified = async () => {
//   const query = `
//     SELECT
//       o.ecrf_id,
//       o.first_name,
//       o.last_name,
//       o.study_enrolled_id,
//       u.email,
//       u.user_id,
//       o.status,
//       EXISTS (
//         SELECT 1
//         FROM patientmedications pm
//         WHERE pm.user_id = u.user_id
//       ) AS in_patientmedications,
//       (o.user_id IS NOT NULL) AS user_in_organization
//     FROM user u
//     LEFT JOIN organization o 
//       ON o.user_id = u.user_id 
//     JOIN user_role ur 
//       ON u.user_id = ur.user_id
//     JOIN role r 
//       ON ur.role_id = r.role_id
//     JOIN patient_account_status pas 
//       ON pas.user_id = u.user_id 
//       AND pas.account_status = 'Accepted'
//     WHERE 
//       r.role_name = 'Subject'
//       -- Condition: not taken meds in the last 24 hours
//       AND NOT EXISTS (
//         SELECT 1 FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//           AND STR_TO_DATE(CONCAT(smr.date, ' ', smr.time), '%Y-%m-%d %H:%i:%s') 
//               >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
//       )
//       -- Condition: a valid schedule exists
//       AND EXISTS (
//         SELECT 1
//         FROM schedule s
//         JOIN schedule_days sd ON s.day_id = sd.day_id
//         JOIN study_schedules ss ON sd.schedule_id = ss.schedule_id
//         WHERE s.user_id = u.user_id
//           AND ss.schedule_id = 2
//           AND s.schedule_date <= CURRENT_DATE()
//       )
//       -- NEW Condition: ensure we have NOT already flagged them 
//       AND NOT EXISTS (
//         SELECT 1 
//         FROM user_missed_medication_log umml
//         WHERE umml.user_id = u.user_id
//           AND umml.resolved_time IS NULL
//       )
//     ;
//   `;

//   try {
//     const [result] = await db.query(query);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

// const getMedicationName = async (user_id) => {
//   const query = `
//     SELECT pm.medication_name
//     FROM patientmedications pm
//     WHERE pm.user_id = ?
//     LIMIT 1
//   `;
//   try {
//     const [results] = await db.query(query, [user_id]);
//     if (results.length > 0) {
//       return results[0].medication_name;
//     } else {
//       return "Unknown Medication";
//     }
//   } catch (err) {
//     throw err;
//   }
// };

// const checkOverdose = async (medicine_id, intake_quantity, user_id) => {
//   const query = `
//     SELECT allot_medicine FROM patientmedications
//     WHERE user_id = ? AND medication_id = ? LIMIT 1
//   `;

//   try {
//     const [rows] = await db.query(query, [user_id, medicine_id]);

//     if (rows.length > 0) {
//       const allot_medicine = rows[0].allot_medicine;
//       return intake_quantity > allot_medicine;
//     } else {
//       console.error("Patient medication data not found");
//       return false;
//     }
//   } catch (err) {
//     console.error("Error in checkOverdose:", err);
//     throw err;
//   }
// };

// const getPatientData = async (user_id) => {
//   const query = `
//     SELECT study_enrolled_id, ecrf_id, organization_detail_id FROM organization WHERE user_id = ? LIMIT 1
//   `;

//   try {
//     const [rows] = await db.query(query, [user_id]);
//     if (rows.length > 0) {
//       return rows[0];
//     } else {
//       console.error("Patient data not found in organization table");
//       return null;
//     }
//   } catch (err) {
//     console.error("Error in getPatientData:", err);
//     throw err;
//   }
// };

// const getRecipients = async (study_enrolled_id, organization_detail_id) => {
//   try {
//     const subjectRoleQuery = `
//       SELECT role_id FROM role WHERE role_name = 'subject' LIMIT 1
//     `;
//     const [subjectRoleRows] = await db.query(subjectRoleQuery);

//     const subjectRoleId = subjectRoleRows[0]?.role_id;
//     if (!subjectRoleId) {
//       console.error("Subject role not found");
//       return [];
//     }

//     const recipientsQuery = `
//       SELECT u.user_id, u.email, o.first_name, o.last_name, o.study_enrolled_id
//       FROM user u
//       JOIN user_role ur ON u.user_id = ur.user_id
//       JOIN role r ON ur.role_id = r.role_id
//       JOIN organization o ON u.user_id = o.user_id
//       WHERE o.study_enrolled_id = ?
//         AND r.role_id != ? AND o.organization_detail_id = ?
//     `;
//     const [recipientsRows] = await db.query(recipientsQuery, [
//       study_enrolled_id,
//       subjectRoleId,
//       organization_detail_id,
//     ]);

//     const recipients = recipientsRows.map((row) => ({
//       email: row.email,
//       firstName: row.first_name,
//       lastName: row.last_name,
//     }));

//     return recipients;
//   } catch (err) {
//     console.error("Error in getRecipients:", err);
//     throw err;
//   }
// };

// const insertMissedMedicationLog = async (userId) => {
//   const query = `
//     INSERT INTO user_missed_medication_log (user_id, email_sent_time)
//     VALUES (?, NOW())
//   `;
//   try {
//     const [result] = await db.query(query, [userId]);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };
// const getUsersToNotify = async (timezone) => {
//   const emailEnabledSubquery = `
//       SELECT personel_id
//       FROM email_sent_notification
//       WHERE email_type_id = 9
//       GROUP BY personel_id
//       HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
//     `;

//   const query = `
//     SELECT u.email, o.first_name, o.last_name, o.timezone, o.ecrf_id, o.study_enrolled_id, o.organization_detail_id,r.role_id
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
//     WHERE r.role_name != 'Subject'
//   `;
//   try {
//     const [results] = await db.query(query);
//     const filteredResult = results.filter((r) => r.timezone === timezone);
//     console.log("============================================");
//     console.log("filtered pateints based on timezone");
//     console.log(filteredResult);
//     console.log("============================================");
//     return filteredResult;
//   } catch (err) {
//     throw err;
//   }
// };
// async function getSubjectsWhoHaveNotSubmittedInLast24Hours() {
//   // const query = `
//   //   SELECT
//   //     u.user_id,
//   //     u.email,
//   //     o.ecrf_id,
//   //     o.study_enrolled_id,
//   //     o.status,
//   //     o.first_name,
//   //     o.last_name,
//   //     o.organization_detail_id,
//   //     CONVERT_TZ(
//   //       CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//   //       'America/Chicago','UTC'
//   //     ) AS window_start_utc,
//   //     CONVERT_TZ(
//   //       CONCAT(DATE(NOW()), ' 08:00:00'),
//   //       'America/Chicago','UTC'
//   //     ) AS window_end_utc,
//   //     (
//   //       SELECT smr.created_at
//   //       FROM submit_medicine_records smr
//   //       WHERE smr.user_id = u.user_id
//   //       ORDER BY smr.created_at DESC
//   //       LIMIT 1
//   //     ) AS last_submission_time,
//   //     TIMESTAMPDIFF(
//   //       HOUR,
//   //       (
//   //         SELECT smr2.created_at
//   //         FROM submit_medicine_records smr2
//   //         WHERE smr2.user_id = u.user_id
//   //         ORDER BY smr2.created_at DESC
//   //         LIMIT 1
//   //       ),
//   //       NOW()
//   //     ) AS hours_since_last_submission
//   //   FROM user u
//   //   JOIN user_role ur ON u.user_id = ur.user_id
//   //   JOIN role r ON ur.role_id = r.role_id
//   //   JOIN organization o ON u.user_id = o.user_id
//   //   WHERE
//   //     r.role_name = 'Subject'
//   //     AND o.status = 'Randomized'
//   //     AND NOT EXISTS (
//   //       SELECT 1
//   //       FROM submit_medicine_records smr
//   //       WHERE smr.user_id = u.user_id
//   //         AND smr.created_at >= CONVERT_TZ(
//   //           CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//   //           'America/Chicago','UTC'
//   //         )
//   //         AND smr.created_at < CONVERT_TZ(
//   //           CONCAT(DATE(NOW()), ' 08:00:00'),
//   //           'America/Chicago','UTC'
//   //         )
//   //     )
//   // `;

//   const query = `
//     SELECT
//       u.user_id,
//       u.email,
//       o.ecrf_id,
//       o.study_enrolled_id,
//       o.status,
//       o.first_name,
//       o.last_name,
//       o.organization_detail_id,
//       CONVERT_TZ(
//         CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//         'America/Chicago','UTC'
//       ) AS window_start_utc,
//       CONVERT_TZ(
//         CONCAT(DATE(NOW()), ' 08:00:00'),
//         'America/Chicago','UTC'
//       ) AS window_end_utc,
//       (
//         SELECT smr.created_at
//         FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//         ORDER BY smr.created_at DESC
//         LIMIT 1
//       ) AS last_submission_time,
//       TIMESTAMPDIFF(
//         HOUR,
//         (
//           SELECT smr2.created_at
//           FROM submit_medicine_records smr2
//           WHERE smr2.user_id = u.user_id
//           ORDER BY smr2.created_at DESC
//           LIMIT 1
//         ),
//         NOW()
//       ) AS hours_since_last_submission
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     JOIN patient_account_status pas on pas.user_id = u.user_id AND pas.account_status = "Accepted"
//     WHERE
//       r.role_name = 'Subject'
//       AND o.status = 'Randomized'
//       AND NOT EXISTS (
//         SELECT 1
//         FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//           AND smr.created_at >= CONVERT_TZ(
//             CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
//             'America/Chicago','UTC'
//           )
//           AND smr.created_at < CONVERT_TZ(
//             CONCAT(DATE(NOW()), ' 08:00:00'),
//             'America/Chicago','UTC'
//           )
//       )
//   `;

//   try {
//     const [rows] = await db.query(query);
//     return rows;
//   } catch (error) {
//     throw error;
//   }
// }

// // async function getSubjectsWhoHaveNotSubmittedInLast24Hours() {
// //   const query = `
// //     SELECT
// //       u.user_id,
// //       u.email,
// //       o.ecrf_id,
// //       o.study_enrolled_id,
// //       o.status,
// //       o.first_name,
// //       o.last_name,
// //       o.organization_detail_id,
// //       CONVERT_TZ(
// //         CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
// //         'America/Chicago','UTC'
// //       ) AS window_start_utc,
// //       CONVERT_TZ(
// //         CONCAT(DATE(NOW()), ' 08:00:00'),
// //         'America/Chicago','UTC'
// //       ) AS window_end_utc,
// //       (
// //         SELECT smr.created_at
// //         FROM submit_medicine_records smr
// //         WHERE smr.user_id = u.user_id
// //         ORDER BY smr.created_at DESC
// //         LIMIT 1
// //       ) AS last_submission_time,
// //       TIMESTAMPDIFF(
// //         HOUR,
// //         (
// //           SELECT smr2.created_at
// //           FROM submit_medicine_records smr2
// //           WHERE smr2.user_id = u.user_id
// //           ORDER BY smr2.created_at DESC
// //           LIMIT 1
// //         ),
// //         NOW()
// //       ) AS hours_since_last_submission
// //     FROM user u
// //     JOIN user_role ur ON u.user_id = ur.user_id
// //     JOIN role r ON ur.role_id = r.role_id
// //     JOIN organization o ON u.user_id = o.user_id
// //     JOIN patient_account_status pas on pas.user_id = u.user_id AND pas.account_status = "Accepted"
// //     WHERE
// //       r.role_name = 'Subject'
// //       AND o.status = 'Randomized'
// //       AND NOT EXISTS (
// //         SELECT 1
// //         FROM submit_medicine_records smr
// //         WHERE smr.user_id = u.user_id
// //           AND smr.created_at >= CONVERT_TZ(
// //             CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:00:00'),
// //             'America/Chicago','UTC'
// //           )
// //           AND smr.created_at < CONVERT_TZ(
// //             CONCAT(DATE(NOW()), ' 08:00:00'),
// //             'America/Chicago','UTC'
// //           )
// //       )
// //   `;

// //   try {
// //     const [rows] = await db.query(query);
// //     return rows;
// //   } catch (error) {
// //     throw error;
// //   }
// // }

// // const getUsersToNotify = async () => {
// //   const query = `
// //     SELECT
// //       u.email,
// //       o.first_name,
// //       o.last_name,
// //       o.ecrf_id,
// //       o.study_enrolled_id,
// //       o.organization_detail_id,
// //       ur.role_id
// //     FROM user u
// //     JOIN user_role ur ON u.user_id = ur.user_id
// //     JOIN role r ON ur.role_id = r.role_id
// //     JOIN organization o ON u.user_id = o.user_id
// //     WHERE r.role_name != 'Subject'
// //   `;

// //   try {
// //     const [results] = await db.query(query);
// //     return results;
// //   } catch (err) {
// //     throw err;
// //   }
// // };

// module.exports = {
//   createMedicine,
//   getAllMedication,
//   getAllMedicationForInvestigator,
//   getMedicationById,
//   getMedicationByUserId,
//   updateMedication,
//   deleteMedication,
//   getMedicationByUserIdForPortal,
//   updateEmailCount,
//   submitMedicineRecord,
//   getQuestionsAndOptions,
//   submitmedicineResponseModel,
//   getSubmitMedicationRecordByUserId,
//   getMedicationsWithDosageTimes,
//   getPatientsWhoMissedAndNotNotified,
//   getMedicationName,
//   getUsersToNotify,
//   checkOverdose,
//   getRecipients,
//   getPatientData,
//   insertMissedMedicationLog,
//   getSubjectsWhoHaveNotSubmittedInLast24Hours,
//   disbaleMedicineRecord,
//   getOrganizationById,
//   getPriscribeATDate,
// };
