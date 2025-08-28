const express = require("express");

const drinkController = require("../../controllers/drink/drinkController");

const router = express.Router();

router.post("/createdrink", drinkController.createDrink);
router.get("/getdrink", drinkController.getDrink);

module.exports = router;
