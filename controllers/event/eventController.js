const fs = require("fs").promises;
const path = require("path");
const eventModel = require("../../models/event/eventModel");

// Create event controller
const createEvent = async (req, res) => {
  try {
    const {
      userId,
      eventDate,
      timeSlot,
      eventDescription,
      investigatorId,
      timezoneOffset,
    } = req.body;

    // Parse the eventDate string into a Date object
    const parsedDate = new Date(eventDate);

    const result = await eventModel.createEvent(
      userId,
      investigatorId,
      parsedDate.toISOString().split("T")[0],
      timeSlot,
      eventDescription
    );

    // Path to the static Excel file
    const staticFilePath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "static",
      "template.xlsx"
    );

    // Generate URL for the Excel file
    const fileUrl = `/static/template.xlsx`;

    res.status(201).json({
      message: "Event created successfully",
      result,
      excelFileUrl: fileUrl,
    });
  } catch (error) {
    console.error("Error in createEvent:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get events for a user controller
const getEventsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await eventModel.getEventsForUser(userId);
    res
      .status(200)
      .json({ message: "Events retrieved successfully", events: result });
  } catch (error) {
    console.error("Error in getEventsForUser:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// New function to save file on the server
const saveFileOnServer = async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName) {
      return res.status(400).json({ message: "Missing folderName" });
    }

    // Create a directory path for the new folder
    const newFolderPath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "saved_files",
      folderName
    );

    // Create the directory if it doesn't exist
    await fs.mkdir(newFolderPath, { recursive: true });

    // Path to the static Excel file
    const staticFilePath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "static",
      "template.xlsx"
    );

    // New file path
    const newFilePath = path.join(newFolderPath, "saved_template.xlsx");

    // Copy the file
    await fs.copyFile(staticFilePath, newFilePath);

    // Generate URL for the saved file
    const savedFileUrl = `/saved_files/${folderName}/saved_template.xlsx`;

    res.status(200).json({
      message: "File saved on server successfully",
      savedFileUrl: savedFileUrl,
    });
  } catch (error) {
    console.error("Error saving file on server:", error);
    res
      .status(500)
      .json({ message: "Error saving file on server", error: error.message });
  }
};

module.exports = {
  createEvent,
  getEventsForUser,
  saveFileOnServer,
};












// const eventModel = require("../../models/event/eventModel");

// // Create event controller
// // When creating an event
// const createEvent = async (req, res) => {
//   try {
//     const {
//       userId,
//       eventDate,
//       timeSlot,
//       eventDescription,
//       investigatorId,
//       timezoneOffset,
//     } = req.body;

//     // Parse the eventDate string into a Date object
//     const parsedDate = new Date(eventDate);
//     // No need to adjust for timezone offset here, as we're using UTC date from frontend

//     const result = await eventModel.createEvent(
//       userId,
//       investigatorId,
//       parsedDate.toISOString().split("T")[0],
//       timeSlot,
//       eventDescription
//     );
//     res.status(201).json({ message: "Event created successfully", result });
//   } catch (error) {
//     console.error("Error in createEvent:", error);
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };
// // Get events for a user controller
// const getEventsForUser = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const result = await eventModel.getEventsForUser(userId);
//     res
//       .status(200)
//       .json({ message: "Events retrieved successfully", events: result });
//   } catch (error) {
//     res.status(500).json({ message: "Internal server error", error });
//   }
// };

// module.exports = {
//   createEvent,
//   getEventsForUser,
// };
