const db = require("../../config/DBConnection3");

// models/manualApiCallsModel.js
const manual_api_calls_model = async (personnel_id, studyIds, siteIds) => {
  if (!personnel_id) {
    throw new Error("personnel_id is required");
  }
  if (studyIds.length === 0 || siteIds.length === 0) {
    throw new Error("At least one study_id and one site_id must be provided");
  }

  try {
    const rows = [];
    for (const site of siteIds) {
      for (const study of studyIds) {
        rows.push([personnel_id, site, study]);
      }
    }

    const placeholders = rows.map(() => "(?, ?, ?)").join(", ");
    const sql = `
      INSERT INTO personnel_assigned_sites_studies
        (personnel_id, site_id, study_id)
      VALUES
        ${placeholders}
    `;

    const flatValues = rows.flat();

    const [result] = await db.execute(sql, flatValues);
    return result;
  } catch (error) {
    console.error("Error in manual_api_calls_model:", error);
    throw error;
  }
};

const getDayNameScheduleNameTable = async () => {
  try {
    const query = `SELECT sd.day_id, sd.day_name, sd.day_order,sd.study_id,sd.offSet, sd.schedule_id, ss.schedule_name, se.study_name FROM schedule_days AS sd
JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id
JOIN study_enrolled AS se ON sd.study_id = se.enrolled_id
ORDER BY sd.study_id, sd.day_id ASC`;
    const [result] = await db.execute(query);

    const scaleQuery = `SELECT scale_id, language_code,scale_name filled_by FROM scale_translations `;
    const result2 = await db.execute(scaleQuery);

    return (data = {
      dayNameScheduleNameTable: result,
      scaleTable: result2[0],
    });
  } catch (error) {
    console.error("Error in manual_api_calls_model:", error);
    throw error;
  }
};

const assignScaleToDays = async (assignments) => {
  // Get a dedicated connection from the pool
  const connection = await db.getConnection();

  try {
    const results = [];
    const query = `INSERT INTO schedule_day_scales (day_id, scale_id) VALUES (?, ?)`;

    // Using a transaction for atomic operation
    await connection.beginTransaction();

    for (const { day_id, scale_id } of assignments) {
      if (!day_id || !scale_id) {
        throw new Error("Invalid assignment: day_id and scale_id are required");
      }

      const [result] = await connection.execute(query, [day_id, scale_id]);
      results.push({
        day_id,
        scale_id,
        success: true,
        insertId: result.insertId,
      });
    }

    await connection.commit();
    return results;
  } catch (error) {
    // Rollback in case of error
    await connection.rollback();
    console.error("Error in manual_api_calls_model:", error);
    throw error;
  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
};

module.exports = {
  manual_api_calls_model,
  getDayNameScheduleNameTable,
  assignScaleToDays,
};
