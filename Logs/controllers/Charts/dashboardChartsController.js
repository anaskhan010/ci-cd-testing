const dashboardChartsModel = require("../../models/Charts/dashboardChartsModel");
const jwt = require("jsonwebtoken");

const subject_chart_controller = async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Token is missing" });
    }

    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

    const user_id = decoded.user_id;

    console.log(user_id, "check role for chart ==========");
    const result = await dashboardChartsModel.subject_Charts_model(user_id);
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(404).json(error);
  }
};

module.exports = {
  subject_chart_controller,
};
