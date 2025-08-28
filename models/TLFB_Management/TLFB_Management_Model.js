// models/TLFB_Management/TLFB_Management_Model.js
const db = require("../../config/DBConnection3");

const createTLFBFolder = async ({
  site_id,
  study_id,
  source_id,
  name,
  file_path,
  personnelId,
}) => {
  console.log(personnelId, "====model =====");
  const query = `
    INSERT INTO TLFB_excel_file 
      (site_id,study_id, source_id, name, file_path, personel_id)
    VALUES (?, ?,?, ?,?, ?)
  `;
  const values = [site_id, study_id, source_id, name, file_path, personnelId];
  const [result] = await db.query(query, values);
  return result;
};

const getOrganizationName = async (site_id) => {
  const query = `
    SELECT organization_name 
    FROM organization_details 
    WHERE organization_detail_id = ?
  `;
  const [rows] = await db.query(query, [site_id]);
  return rows[0]?.organization_name || null;
};

const getStudyName = async (study_id) => {
  // Adjust the table name and column names based on your database schema
  const query = `SELECT study_name FROM study_enrolled WHERE enrolled_id = ?`;
  const [rows] = await db.query(query, [study_id]);
  if (rows.length > 0) {
    return rows[0].study_name;
  }
  return null;
};

module.exports = {
  createTLFBFolder,
  getOrganizationName,
  getStudyName,
};
