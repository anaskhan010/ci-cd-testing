const drinkModel = require("../../models/drink/drinkModel");
const auditLog = require("../../middleware/audit_logger.js");
// create drink controller
const createDrink = async (req, res) => {
  try {
    const { drink_name, drink_size, percentage, quantity, status } = req.body;

    // Call the model function to create the drink
    const result = await drinkModel.createDrink(
      drink_name,
      drink_size,
      percentage,
      quantity,
      status
    );

    // Prepare data for the audit log
    const newDrinkData = {
      drink_name,
      drink_size,
      percentage,
      quantity,
      status,
    };

    // Log the creation operation
    auditLog(
      "CREATE", // Operation type
      "Drink", // Entity name
      null, // No old value since it's a creation
      newDrinkData, // New data
      "New drink created successfully" // Description
    )(req, res, () => {});

    res.status(201).json({
      message: "Drink created successfully",
      result,
    });
  } catch (error) {
    console.error("Error creating drink:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message || error,
    });
  }
};

// get drink controller
const getDrink = async (req, res) => {
  try {
    const result = await drinkModel.getDrink();
    res.status(200).json({ message: "Get drink successfully", result });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

module.exports = {
  createDrink,
  getDrink,
};
