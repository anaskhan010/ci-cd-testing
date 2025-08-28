// const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// // Create a new page
// const createPage = async (
//   page_name,
//   temp_page_name,
//   route,
//   icon,
//   label,
//   data_tour
// ) => {
//   const query = `INSERT INTO pages (page_name,temp_page_name, route, icon, label, data_tour) VALUES (?, ?, ?,?, ?, ?)`;
//   try {
//     const [result] = await db.query(query, [
//       page_name,
//       temp_page_name,
//       route,
//       icon,
//       label,
//       data_tour,
//     ]);
//     return result;
//   } catch (error) {
//     throw error;
//   }
// };

// // Create page permissions
// const createPagePermissionModel = async (
//   study_id,
//   role_id,
//   page_ids,
//   status = "Enable"
// ) => {
//   const values = page_ids.map((page_id) => [
//     study_id,
//     role_id,
//     page_id,
//     status,
//   ]);
//   const query = `INSERT INTO page_permission (study_id, role_id, page_id, status) VALUES ?`;
//   try {
//     const [result] = await db.query(query, [values]);
//     return result;
//   } catch (error) {
//     throw error;
//   }
// };

// // Get pages with permission
// const getSubmitPageswithPermission = async (study_id, role_id) => {
//   const query = `
//     SELECT DISTINCT p.page_id,p.temp_page_name, p.page_name, p.icon, p.route
//     FROM page_permission AS pp
//     JOIN pages AS p ON pp.page_id = p.page_id
//     WHERE pp.study_id = ? AND pp.role_id = ? AND pp.status = 'Enable'`;
//   try {
//     const [result] = await db.query(query, [study_id, role_id]);
//     return result;
//   } catch (error) {
//     throw error;
//   }
// };

// // Update page permissions
// const updatePagePermission = async (
//   study_id,
//   role_id,
//   page_ids,
//   status = "Enable"
// ) => {
//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     // Delete existing permissions
//     const deleteQuery = `DELETE FROM page_permission WHERE study_id = ? AND role_id = ?`;
//     await connection.query(deleteQuery, [study_id, role_id]);

//     // Insert new permissions
//     const values = page_ids.map((page_id) => [
//       study_id,
//       role_id,
//       page_id,
//       status,
//     ]);
//     const insertQuery = `INSERT INTO page_permission (study_id, role_id, page_id, status) VALUES ?`;
//     await connection.query(insertQuery, [values]);

//     await connection.commit();
//     return { message: "Page permissions updated successfully" };
//   } catch (err) {
//     await connection.rollback();
//     throw err;
//   } finally {
//     connection.release();
//   }
// };

// // Get all pages
// const getAllPages = async () => {
//   const query = `SELECT * FROM pages`;
//   try {
//     const [result] = await db.query(query);
//     return result;
//   } catch (error) {
//     throw error;
//   }
// };

// module.exports = {
//   getAllPages,
//   createPage,
//   createPagePermissionModel,
//   getSubmitPageswithPermission,
//   updatePagePermission,
// };

// models/pages_permission/pagePermissionModel.js
const db = require("../../config/DBConnection3.js");

// Create a new page with an optional order value (default = 0)
const createPage = async (
  page_name,
  temp_page_name,
  route,
  icon,
  label,
  data_tour,
  page_order = 0
) => {
  const query = `INSERT INTO pages (page_name, temp_page_name, route, icon, label, data_tour, page_order) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  try {
    const [result] = await db.query(query, [
      page_name,
      temp_page_name,
      route,
      icon,
      label,
      data_tour,
      page_order,
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

const createPagePermissionModel = async (
  study_id,
  role_id,
  page_ids,
  status = "Enable"
) => {
  const values = page_ids.map((page_id) => [
    study_id,
    role_id,
    page_id,
    status,
  ]);
  const query = `INSERT INTO page_permission (study_id, role_id, page_id, status) VALUES ?`;
  try {
    const [result] = await db.query(query, [values]);
    return result;
  } catch (error) {
    throw error;
  }
};

// Get pages with permission, now including page_order and ordering by it
const getSubmitPageswithPermission = async (study_id, role_id) => {
  const query = `
    SELECT DISTINCT p.page_id, p.temp_page_name, p.page_name, p.icon, p.route, p.page_order
    FROM page_permission AS pp
    JOIN pages AS p ON pp.page_id = p.page_id
    WHERE pp.study_id = ? AND pp.role_id = ? AND pp.status = 'Enable'
    ORDER BY p.page_order ASC
  `;
  try {
    const [result] = await db.query(query, [study_id, role_id]);
    return result;
  } catch (error) {
    throw error;
  }
};

const updatePagePermission = async (
  study_id,
  role_id,
  page_ids,
  status = "Enable"
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Delete existing permissions
    const deleteQuery = `DELETE FROM page_permission WHERE study_id = ? AND role_id = ?`;
    await connection.query(deleteQuery, [study_id, role_id]);

    // Insert new permissions
    const values = page_ids.map((page_id) => [
      study_id,
      role_id,
      page_id,
      status,
    ]);
    const insertQuery = `INSERT INTO page_permission (study_id, role_id, page_id, status) VALUES ?`;
    await connection.query(insertQuery, [values]);

    await connection.commit();
    return { message: "Page permissions updated successfully" };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// Get all pages ordered by page_order
const getAllPages = async () => {
  const query = `SELECT * FROM pages ORDER BY page_order ASC`;
  try {
    const [result] = await db.query(query);
    return result;
  } catch (error) {
    throw error;
  }
};

// New: Update the order for multiple pages
const updatePageOrder = async (pages) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const page of pages) {
      const query = "UPDATE pages SET page_order = ? WHERE page_id = ?";
      await connection.query(query, [page.page_order, page.page_id]);
    }
    await connection.commit();
    return { message: "Page order updated successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getPagesByIds = async (page_ids) => {
  const query = `
    SELECT page_id, temp_page_name, page_name, icon, route, page_order
    FROM pages
    WHERE page_id IN (?)
    ORDER BY page_order ASC
  `;
  try {
    const [result] = await db.query(query, [page_ids]);
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllPages,
  createPage,
  createPagePermissionModel,
  getSubmitPageswithPermission,
  updatePagePermission,
  updatePageOrder,
  getPagesByIds,
};
