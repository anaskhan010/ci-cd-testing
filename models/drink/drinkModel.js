const db = require("../../config/DBConnection3.js");

const createDrink = async (
  drink_name,
  drink_size,
  percentage,
  quantity,
  status
) => {
  try {
    const query = `INSERT INTO drinkss (drink_name, drink_size, percentage, quantity, status) VALUES (?, ?, ?, ?, ?)`;
    const [result] = await db.query(query, [
      drink_name,
      drink_size,
      percentage,
      quantity,
      status,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getDrink = async () => {
  try {
    const query = `SELECT * FROM drinkss`;
    const [result] = await db.query(query);
    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createDrink,
  getDrink,
};
