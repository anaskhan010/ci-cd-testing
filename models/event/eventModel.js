const db = require("../../config/DBConnection3.js");

// Create event model
const createEvent = async (
  userId,
  investigatorId,
  eventDate,
  timeSlot,
  eventDescription
) => {
  try {
    const query = `INSERT INTO events (user_id, investigator_id, event_date, time_slot, event_description) VALUES (?, ?, ?, ?, ?)`;
    const values = [
      userId,
      investigatorId,
      eventDate,
      timeSlot,
      eventDescription,
    ];
    console.log("SQL Query:", query);
    console.log("Values:", values);
    const [result] = await db.query(query, values);
    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw err;
  }
};

// Get events for a user
const getEventsForUser = async (userId) => {
  try {
    const query = `
      SELECT 
        id, 
        user_id, 
        investigator_id, 
        DATE_FORMAT(event_date, '%Y-%m-%d') as event_date, 
        time_slot, 
        event_description, 
        created_at, 
        updated_at 
      FROM events 
      WHERE user_id = ? 
      ORDER BY event_date, time_slot
    `;
    const [result] = await db.query(query, [userId]);
    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createEvent,
  getEventsForUser,
};
