const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Create Notification Model
async function createNotification(role_id, status, notification) {
  const notificationQuery =
    "INSERT INTO notification (role_id, status, notification) VALUES (?, ?, ?)";
  try {
    const [result] = await db.query(notificationQuery, [
      role_id,
      status,
      notification,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
}

// Get Notifications and Unread Count
async function getNotification(role_id) {
  const notificationQuery = `
    SELECT * FROM notification WHERE status = 'unread' AND role_id = ?
  `;
  const countQuery = `
    SELECT COUNT(*) AS unread_count FROM notification WHERE status = 'unread' AND role_id = ?
  `;

  try {
    // Logging role_id for debugging
    console.log("Role ID:", role_id);

    const [notifications] = await db.query(notificationQuery, [role_id]);
    // Logging notifications for debugging
    console.log("Notifications Query Result:", notifications);

    const [countResult] = await db.query(countQuery, [role_id]);
    // Logging countResult for debugging
    console.log("Count Query Result:", countResult);

    return {
      notifications: notifications,
      unread_count: countResult[0].unread_count,
    };
  } catch (err) {
    throw err;
  }
}

// Update Notification Status to 'read'
async function updateNotification(notification_id) {
  const notificationQuery =
    "UPDATE notification SET status = 'read' WHERE notification_id = ?";
  try {
    const [result] = await db.query(notificationQuery, [notification_id]);
    return result;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  createNotification,
  getNotification,
  updateNotification,
};
