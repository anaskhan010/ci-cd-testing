const db = require("../../config/DBConnection3");

const getTLFBSubjectByUserId = async (userId) => {
  const query = "SELECT * FROM tlfb_subject WHERE user_id = ? LIMIT 1";
  const [rows] = await db.query(query, [userId]);
  return rows.length > 0 ? rows[0] : null;
};

module.exports = {
  getTLFBSubjectByUserId,
};
