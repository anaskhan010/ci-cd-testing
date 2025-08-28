const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

const createPage = async (page_name) => {
  try {
    const query = "INSERT INTO pages (page_name) VALUES (?)";
    const [result] = await db.query(query, [page_name]);
    return result;
  } catch (err) {
    throw err;
  }
};

// Get all pages
const getPages = async () => {
  try {
    const query = "SELECT * FROM pages";
    const [result] = await db.query(query);
    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createPage,
  getPages,
};
