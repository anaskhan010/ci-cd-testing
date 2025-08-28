const db = require("../../config/DBConnection3");
const crypto = require("crypto");

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

const createEmailType = async (name, description, investigator_id) => {
  const query = `INSERT into email_types (name,description,investigator_id) VALUES(?,?,?)`;
  const values = [name, description, investigator_id];
  const [result] = await db.execute(query, values);
  return result;
};

const getAllEmailTypes = async () => {
  try {
    const query = `SELECT * FROM email_types`;
    const [result] = await db.execute(query);
    return result;
  } catch (error) {
    return error;
  }
};

const getAllPersonels = async () => {
  const query = `SELECT u.email,ur.user_id, o.first_name, o.last_name FROM user_role ur 
JOIN organization AS o ON ur.user_id = o.user_id
JOIN user AS u ON o.user_id = u.user_id
WHERE ur.role_id !=10`;
  const [result] = await db.execute(query);
  const checkResult = result.map((data) => {
    try {
      return {
        ...data,
        first_name: decrypt(data.first_name),
        last_name: decrypt(data.last_name),
      };
    } catch (error) {
      console.log(error);
    }
  });
  return checkResult;
};

const getAllNotificationByPersonelId = async ( personel_id) => {

  const query = `SELECT * FROM email_sent_notification WHERE  personel_id = ?`;
  const [result] = await db.execute(query, [ personel_id]);
  return result;
};

const updateNotificationEnableDisable = async (
  email_type_id,
  personel_id,
  status
) => {
  try {
    // First check if the record exists
    const checkQuery = `SELECT * FROM email_sent_notification 
                        WHERE email_type_id = ? AND personel_id = ?`;
    const [existingRecords] = await db.execute(checkQuery, [email_type_id, personel_id]);
    
    let result;
    
    if (existingRecords.length > 0) {
      // Update existing record
      const updateQuery = `UPDATE email_sent_notification 
                          SET status = ? 
                          WHERE email_type_id = ? AND personel_id = ?`;
      const values = [status, email_type_id, personel_id];
      [result] = await db.execute(updateQuery, values);
    } else {
      // Insert new record
      const insertQuery = `INSERT INTO email_sent_notification 
                          (email_type_id, personel_id, status) 
                          VALUES (?, ?, ?)`;
      const values = [email_type_id, personel_id, status];
      [result] = await db.execute(insertQuery, values);
    }
    
    return result;
  } catch (error) {
    console.error("Error in updateNotificationEnableDisable:", error);
    throw error;
  }
};

module.exports = {
  createEmailType,
  getAllEmailTypes,
  getAllPersonels,
  getAllNotificationByPersonelId,
  updateNotificationEnableDisable,
};

// const db = require("../../config/DBConnection3");
// const crypto = require("crypto");

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

// const createEmailType = async (name, description, investigator_id) => {
//   const query = `INSERT into email_types (name,description,investigator_id) VALUES(?,?,?)`;
//   const values = [name, description, investigator_id];
//   const [result] = await db.execute(query, values);
//   return result;
// };

// const getAllEmailTypes = async () => {
//   try {
//     const query = `SELECT * FROM email_types`;
//     const [result] = await db.execute(query);
//     return result;
//   } catch (error) {
//     return error;
//   }
// };

// const createEmailControlModel = async (
//   email_type_id,
//   site_id,
//   study_id,
//   investigatorId,
//   user_ids,
//   personel_id,
//   status = "Active"
// ) => {
//   console.log(
//     email_type_id,
//     site_id,
//     study_id,
//     investigatorId,
//     user_ids,
//     personel_id,
//     "====Model===="
//   );
//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();
//     const query = `INSERT into email_control (email_type_id,site_id,study_enrolled_id,investigator_id,status) VALUES(?,?,?,?,?)`;
//     const values = [email_type_id, site_id, study_id, investigatorId, status];
//     const [result] = await connection.execute(query, values);
//     const control_id = result.insertId;
//     const query2 = `INSERT into email_control_parent (email_control_id,subject_id,personel_id) VALUES(?,?,?)`;
//     await Promise.all(
//       user_ids.map((user_id) =>
//         connection.execute(query2, [control_id, user_id, personel_id])
//       )
//     );
//     await connection.commit();
//     return result;
//   } catch (error) {
//     await connection.rollback();
//     throw error;
//   } finally {
//     connection.release();
//   }
// };

// const getEmailControlByidModel = async (email_type_id, personel_id) => {
//   const query = `SELECT ec.*, ecp.subject_id, ecp.personel_id FROM email_control ec JOIN email_control_parent ecp ON ec.control_id = ecp.email_control_id WHERE ec.email_type_id = ? AND ecp.personel_id = ?`;
//   const [rows] = await db.execute(query, [email_type_id, personel_id]);
//   return rows;
// };

// const updateEmailControlModel = async (
//   control_id,
//   email_type_id,
//   site_id,
//   study_id,
//   investigatorId,
//   user_ids,
//   personel_id,
//   status = "Active"
// ) => {
//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();
//     const query = `UPDATE email_control SET email_type_id = ?, site_id = ?, study_enrolled_id = ?, investigator_id = ?, status = ? WHERE id = ?`;
//     const values = [
//       email_type_id,
//       site_id,
//       study_id,
//       investigatorId,
//       status,
//       control_id,
//     ];
//     await connection.execute(query, values);
//     const delQuery = `DELETE FROM email_control_parent WHERE email_control_id = ?`;
//     await connection.execute(delQuery, [control_id]);
//     const query2 = `INSERT INTO email_control_parent (email_control_id, subject_id, personel_id) VALUES (?, ?, ?)`;
//     await Promise.all(
//       user_ids.map((user_id) =>
//         connection.execute(query2, [control_id, user_id, personel_id])
//       )
//     );
//     await connection.commit();
//     return { message: "Update successful" };
//   } catch (error) {
//     await connection.rollback();
//     throw error;
//   } finally {
//     connection.release();
//   }
// };

// const getAllPersonels = async (site_id, study_id) => {
//   const query = `SELECT o.user_id, o.first_name, o.last_name from organization AS o
// JOIN user_role AS ur ON o.user_id = ur.user_id
// JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id
// JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
// WHERE o.organization_detail_id = ? AND o.study_enrolled_id =? `;
//   const [result] = await db.execute(query, [site_id, study_id]);
//   const checkResult = result.map((data) => {
//     try {
//       return {
//         ...data,
//         first_name: decrypt(data.first_name),
//         last_name: decrypt(data.last_name),
//       };
//     } catch (error) {
//       console.log(error);
//     }
//   });
//   return checkResult;
// };

// const getAllSubjects = async (personel_id) => {
//   const query = `SELECT o.user_id, o.first_name, o.last_name from organization AS o
// JOIN personel_subject AS ps ON o.user_id = ps.subject_id
// WHERE ps.personel_id = ? `;
//   const [result] = await db.execute(query, [personel_id]);
//   const checkResult = result.map((data) => {
//     try {
//       return {
//         ...data,
//         first_name: decrypt(data.first_name),
//         last_name: decrypt(data.last_name),
//       };
//     } catch (error) {
//       console.log(error);
//     }
//   });
//   return checkResult;
// };

// module.exports = {
//   createEmailType,
//   getAllEmailTypes,
//   createEmailControlModel,
//   getEmailControlByidModel,
//   updateEmailControlModel,
//   getAllPersonels,
//   getAllSubjects,
// };
