const { body, validationResult } = require("express-validator");
const pageModel = require("../../models/pages/pageModel");

// Validation rules
const validateCreatePage = [
  body("page_name").notEmpty().withMessage("Page name is required"),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: false, errors: errors.array() });
  }
  next();
};

// create a page
const createPage = async (req, res) => {
  try {
    const { page_name } = req.body;
    const result = await pageModel.createPage(page_name);
    res.status(201).json({ message: "Page created successfully", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get all pages
const getPages = async (req, res) => {
  try {
    const result = await pageModel.getPages();
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPage: [validateCreatePage, handleValidationErrors, createPage],
  getPages,
};
