const db = require("../config/DBConnection3.js");

const formatDate = (inputDate, format = "YYYY-MM-DD") => {
  // Convert string to Date if necessary
  const date = typeof inputDate === "string" ? new Date(inputDate) : inputDate;

  // Helper function to get the English suffix for day
  const getDaySuffix = (day) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  // Format date in YYYY-MM-DD
  const formatYYYYMMDD = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format date in English format e.g., Jan 1st 2024
  const formatEnglish = () => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    return `${monthNames[monthIndex]} ${day}${getDaySuffix(day)} ${year}`;
  };

  // Format date in US format e.g., MM/DD/YYYY
  const formatUS = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}/${year}`;
  };

  // Format time in HH:MM:SS
  const formatTime = () => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // Select the formatting function based on the format parameter
  switch (format) {
    case "YYYY-MM-DD":
      return formatYYYYMMDD();
    case "English":
      return formatEnglish();
    case "US":
      return formatUS();
    case "YYYY-MM-DD HH:MM:SS":
      return `${formatYYYYMMDD()} ${formatTime()}`;
    default:
      return formatYYYYMMDD();
  }
};

// Insert Patient Account Status
const insertPatientAccountStatus = async function (
  userId,
  accountStatus,
  reason
) {
  try {
    const query = `INSERT INTO patient_account_status (user_id, account_status, reason, updated_at) VALUES (?, ?, ?, ?)`;
    const currentDate = new Date();
    const [result] = await db.query(query, [
      userId,
      accountStatus,
      reason,
      currentDate,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

// Block User Account
const blockUserAccount = async function (userId, reason) {
  try {
    // Check if a row already exists for the user
    const checkQuery = `SELECT * FROM patient_account_status WHERE user_id = ?`;
    const [checkResult] = await db.query(checkQuery, [userId]);

    const currentDate = new Date();
    if (checkResult.length > 0) {
      // Row exists, update it
      const updateQuery = `
        UPDATE patient_account_status 
        SET account_status = 'Blocked', reason = ?, updated_at = ? 
        WHERE user_id = ?`;
      const [updateResult] = await db.query(updateQuery, [
        reason,
        currentDate,
        userId,
      ]);
      return updateResult;
    } else {
      // Row does not exist, insert a new row
      const insertQuery = `
        INSERT INTO patient_account_status (user_id, account_status, reason, updated_at) 
        VALUES (?, 'Blocked', ?, ?)`;
      const [insertResult] = await db.query(insertQuery, [
        userId,
        reason,
        currentDate,
      ]);
      return insertResult;
    }
  } catch (err) {
    throw err;
  }
};

module.exports = { formatDate, insertPatientAccountStatus, blockUserAccount };
