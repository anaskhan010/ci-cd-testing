const socketIo = require("socket.io");
const notificationModel = require("../models/notification/notificationModel");
const http = require("http");

var socket = null;

var init = function (server) {
  var httpServer = http.createServer(server);
  var ioServer = socketIo(httpServer);
  ioServer.on("connection", function (socket) {
    console.log("A user connected");
  });
  httpServer.listen(3001, function () {
    console.log("Socket server running on port 3001");
  });
  socket = ioServer;
};

var sendNotification = function (role_id, status, notification) {
  notificationModel
    .createNotification(role_id, status, notification)
    .then((result) => {
      socket.emit("notification", result);
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = {
  init,
  sendNotification,
};
