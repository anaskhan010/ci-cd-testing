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

// const createPersonelSubject = async (
//   site_ids,
//   study_ids,
//   personel_ids,
//   subject_ids
// ) => {
//   const placeholders = [];
//   const values = [];

//   for (let i = 0; i < site_ids.length; i++) {
//     placeholders.push("(?,?,?,?)");
//     values.push(site_ids[i], study_ids[i], personel_ids[i], subject_ids[i]);
//   }

//   const query = `
//     INSERT INTO personel_subject (site_id, study_id, personel_id, subject_id)
//     VALUES ${placeholders.join(",")}
//   `;
//   const [result] = await db.execute(query, values);
//   return result;
// };

const createPersonelSubject = async (
  site_ids,
  study_ids,
  personel_ids,
  subject_ids
) => {
  // Create a comma-separated list of placeholders for the IN clause
  const checkPlaceholders = personel_ids.map(() => "?").join(",");
  const checkQuery = `
    SELECT personel_id 
    FROM personel_subject 
    WHERE personel_id IN (${checkPlaceholders})
  `;
  const [existing] = await db.execute(checkQuery, personel_ids);

  // If any record exists, throw an error
  if (existing.length > 0) {
    throw new Error("Can not re-assign subjects to this user");
  }

  // If not, proceed with the insertion
  const placeholders = [];
  const values = [];

  for (let i = 0; i < site_ids.length; i++) {
    placeholders.push("(?,?,?,?)");
    values.push(site_ids[i], study_ids[i], personel_ids[i], subject_ids[i]);
  }

  const query = `
    INSERT INTO personel_subject (site_id, study_id, personel_id, subject_id)
    VALUES ${placeholders.join(",")}
  `;

  const [result] = await db.execute(query, values);
  return result;
};

// const getAllPersonels = async () => {
//   const query = `SELECT 
//     r.role_id, 
//     r.role_name,
//     o.user_id,
//     o.study_enrolled_id,
//     se.study_name,
//     o.organization_detail_id,
//     od.organization_name,
//     o.first_name,
//     o.last_name,
//     u.email
// FROM role AS r 
// LEFT JOIN user_role AS ur ON r.role_id = ur.role_id
// JOIN organization AS o ON ur.user_id = o.user_id
// JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id 
// JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
// JOIN patient_account_status AS pas ON o.user_id = pas.user_id
// LEFT JOIN user AS u ON u.user_id = o.user_id
// WHERE r.role_id != 10 AND pas.account_status ="Accepted";`;
//   const [result] = await db.execute(query);
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

const getAllPersonels = async () => {
  // First, get the basic personnel information
  const query = `SELECT 
    r.role_id, 
    r.role_name,
    o.user_id,
    o.study_enrolled_id,
    se.study_name,
    o.organization_detail_id,
    od.organization_name,
    o.first_name,
    o.last_name,
    u.email
FROM role AS r 
LEFT JOIN user_role AS ur ON r.role_id = ur.role_id
JOIN organization AS o ON ur.user_id = o.user_id
JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id 
JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
JOIN patient_account_status AS pas ON o.user_id = pas.user_id
LEFT JOIN user AS u ON u.user_id = o.user_id
WHERE r.role_id != 10 AND pas.account_status ="Accepted";`;
  
  const [result] = await db.execute(query);
  
  // Decrypt basic personnel data
  const personnelList = result.map((data) => {
    try {
      return {
        ...data,
        first_name: decrypt(data.first_name),
        last_name: decrypt(data.last_name),
      };
    } catch (error) {
      console.log(error);
      return data;
    }
  });
  
  // Get all user_ids to fetch their assigned sites and studies
  const userIds = personnelList.map(personnel => personnel.user_id);
  
  if (userIds.length === 0) {
    return personnelList;
  }
  
  // Create placeholders for the IN clause
  const placeholders = userIds.map(() => "?").join(",");
  
  // Query to get assigned sites and studies for all personnel
  const assignedQuery = `
    SELECT 
      pass.personnel_id,
      pass.site_id,
      pass.study_id,
      od.organization_name,
      se.study_name
    FROM personnel_assigned_sites_studies pass
    LEFT JOIN organization_details od ON pass.site_id = od.organization_detail_id
    LEFT JOIN study_enrolled se ON pass.study_id = se.enrolled_id
    WHERE pass.personnel_id IN (${placeholders})
  `;
  
  const [assignedResults] = await db.execute(assignedQuery, userIds);
  
  // Group the assigned sites and studies by personnel_id
  const assignedMap = {};
  
  assignedResults.forEach(item => {
    const personnelId = item.personnel_id;
    
    if (!assignedMap[personnelId]) {
      assignedMap[personnelId] = {
        assigned_sites: [],
        assigned_studies: []
      };
    }
    
    // Check if this site is already added
    const siteExists = assignedMap[personnelId].assigned_sites.some(
      site => site.site_id === item.site_id
    );
    
    if (!siteExists && item.site_id) {
      assignedMap[personnelId].assigned_sites.push({
        site_id: item.site_id,
        organization_name: item.organization_name
      });
    }
    
    // Check if this study is already added
    const studyExists = assignedMap[personnelId].assigned_studies.some(
      study => study.study_id === item.study_id
    );
    
    if (!studyExists && item.study_id) {
      assignedMap[personnelId].assigned_studies.push({
        study_id: item.study_id,
        study_name: item.study_name
      });
    }
  });
  
  // Merge the assigned data with the personnel data
  const enhancedPersonnelList = personnelList.map(personnel => {
    const assigned = assignedMap[personnel.user_id] || { 
      assigned_sites: [], 
      assigned_studies: [] 
    };
    
    return {
      ...personnel,
      assigned_sites: assigned.assigned_sites,
      assigned_studies: assigned.assigned_studies
    };
  });
  
  return enhancedPersonnelList;
};

const getSubjectsBySitesStudies = async (sites, studies) => {
  // Base query
  let query = `SELECT 
      r.role_id, 
      r.role_name,
      u.email,
      o.first_name,
      o.last_name,
      o.user_id,
      o.ecrf_id,
      o.study_enrolled_id,
    se.study_name,
    o.organization_detail_id,
    od.organization_name
    FROM role AS r 
    LEFT JOIN user_role AS ur ON r.role_id = ur.role_id
    JOIN organization AS o ON ur.user_id = o.user_id 
    JOIN user AS u ON u.user_id = o.user_id
    JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id 
JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
    JOIN patient_account_status AS pas ON o.user_id = pas.user_id
    WHERE r.role_id = 10 AND pas.account_status = "Accepted"`;

  const params = [];

  // Add filtering for sites if provided
  if (sites && sites.length > 0) {
    const sitePlaceholders = sites.map(() => "?").join(",");
    query += ` AND o.organization_detail_id IN (${sitePlaceholders})`;
    params.push(...sites);
  }

  // Add filtering for studies if provided
  if (studies && studies.length > 0) {
    const studyPlaceholders = studies.map(() => "?").join(",");
    query += ` AND o.study_enrolled_id IN (${studyPlaceholders})`;
    params.push(...studies);
  }

  const [result] = await db.execute(query, params);

  console.log("===================+++Result here+++=======================");
  console.log(result);

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

const getAssignedSubjectsByPersonnelId = async (personnel_id) => {
  try {
    const [result] = await db.execute(
      `
      SELECT 
        o.*, 
        u.email, 
        org.organization_name, 
        pas.account_status, 
        org.organization_address, 
        notes.note,
        ps.study_id AS enrolled_ids,
        se.study_name AS study_names
      FROM personel_subject ps
      JOIN organization o ON ps.subject_id = o.user_id
      JOIN user u ON o.user_id = u.user_id
      JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
      JOIN study_enrolled se ON ps.study_id = se.enrolled_id
      JOIN (
          SELECT user_id, MAX(note) AS note FROM note GROUP BY user_id
      ) AS notes ON u.user_id = notes.user_id
      JOIN patient_account_status pas ON u.user_id = pas.user_id
      JOIN user_role ur ON u.user_id = ur.user_id
      WHERE pas.account_status = 'Accepted'
        AND ur.role_id = 10
        AND ps.personel_id = ?
      ORDER BY ps.personel_subject_id DESC;
      `,
      [personnel_id]
    );

    // Decrypt and transform study data (keeping original key names)
    const decryptedResult = result.map((org) => {
      try {
        const enrolledIds = org.enrolled_ids
          ? org.enrolled_ids.toString().split(",")
          : [];
        const studyNames = org.study_names
          ? org.study_names.toString().split(",")
          : [];

        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          middle_name: decrypt(org.middle_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          // Mimic your previous key name for study information:
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id, 10),
            name: studyNames[index] || "",
          })),
        };
      } catch (error) {
        console.error("Decryption error:", error);
        return org;
      }
    });

    return decryptedResult;
  } catch (err) {
    throw err;
  }
};

// Update assigned subjects for a given personnel (role)
// This function first deletes existing assignments for the personnel,
// then inserts the new ones.
const updateAssignedSubjects = async (
  personnel_id,
  site_ids,
  study_ids,
  subject_ids
) => {
  if (
    site_ids.length !== study_ids.length ||
    site_ids.length !== subject_ids.length
  ) {
    throw new Error("All arrays must have the same length");
  }
  try {
    // Delete existing assignments for the given personnel
    await db.execute(`DELETE FROM personel_subject WHERE personel_id = ?`, [
      personnel_id,
    ]);

    // Build multi-row insert for new assignments
    const placeholders = [];
    const values = [];
    for (let i = 0; i < site_ids.length; i++) {
      placeholders.push("(?, ?, ?, ?)");
      values.push(site_ids[i], study_ids[i], personnel_id, subject_ids[i]);
    }
    const query = `
      INSERT INTO personel_subject (site_id, study_id, personel_id, subject_id)
      VALUES ${placeholders.join(",")}
    `;
    const [result] = await db.execute(query, values);
    return result;
  } catch (err) {
    throw err;
  }
};
module.exports = {
  createPersonelSubject,
  getAllPersonels,
  getSubjectsBySitesStudies,
  getAssignedSubjectsByPersonnelId,
  updateAssignedSubjects,
};
