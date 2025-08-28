const express = require("express");
const router = express.Router();
const eventController = require("../../controllers/event/eventController");

// Create event route
router.post("/create", eventController.createEvent);

// Get events for a user route
router.get("/user/:userId", eventController.getEventsForUser);

// Save file on server route
router.post("/saveFileOnServer", eventController.saveFileOnServer);

module.exports = router;











// const express = require("express");
// const router = express.Router();
// const eventController = require("../../controllers/event/eventController");

// // Create event route
// router.post("/create", eventController.createEvent);

// // Get events for a user route
// router.get("/user/:userId", eventController.getEventsForUser);

// module.exports = router;
