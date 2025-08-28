const medicineCommentModel = require("../../models/medication/medicineCommentModel");
const jwt = require("jsonwebtoken");

const createMedicineCommentController = async (req, res) => {
  const { medicine_id, record_id, user_id, medicine_date, comment } = req.body;
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const investagator_id = decoded.user_id;

    const data = await medicineCommentModel.medicineCommentModel(
      medicine_id,
      record_id,
      user_id,
      investagator_id,
      medicine_date,
      comment
    );

    res
      .status(200)
      .json({ message: "mediciation Comment Add Sucessfully", data: data });
  } catch (error) {
    console.log(error.message);
    res.status(500).json(error);
  }
};

const getMedicineController = async (req, res) => {
  const { record_id } = req.params;
  try {
    const data = await medicineCommentModel.getMedicineCommentsModel(record_id);
    res.status(200).json({ message: "Medicine Comments", data: data });
  } catch (error) {
    console.log(error.message);
    res.status(500).json(error);
  }
};

module.exports = {
  createMedicineCommentController,
  getMedicineController,
};
