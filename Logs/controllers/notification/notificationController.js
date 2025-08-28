const notificationModel = require("../../models/notification/notificationModel");

// Get Notification
var getNotification = async function (req, res) {
  var role_id = req.params.id;
  console.log(role_id);
  try {
    var notification = await notificationModel.getNotification(role_id);
    res.status(200).json({
      status: true,
      message: "Notification",
      notification: notification,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Update Notification as read
var updateNotification = async function (req, res) {
  var notification_id = req.params.id;
  try {
    var notification = await notificationModel.updateNotification(
      notification_id
    );
    res.status(200).json({
      message: "Notification Updated",
      notification: notification,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getNotification,
  updateNotification,
};
