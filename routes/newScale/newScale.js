const express = require("express");

const router = express.Router();

const newScaleController = require("../../controllers/newScale/newScale");

router.post("/create", newScaleController.createScale);

router.get("/:id", newScaleController.getScaleById);
// Add the new update route
router.put('/update-scale/:id', newScaleController.updateScale);
module.exports = router;
