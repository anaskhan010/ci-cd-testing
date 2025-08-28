const personelSubjectModel = require("../../models/PersonelSubject/PersonelSubjectModel");

const createPersonelSubjectController = async (req, res) => {
  const { site_ids, study_ids, personel_ids, subject_ids } = req.body;
  if (
    site_ids.length !== study_ids.length ||
    site_ids.length !== personel_ids.length ||
    site_ids.length !== subject_ids.length
  ) {
    return res
      .status(400)
      .json({ error: "All arrays must have the same length" });
  }

  try {
    const result = await personelSubjectModel.createPersonelSubject(
      site_ids,
      study_ids,
      personel_ids,
      subject_ids
    );
    res.status(200).json({ message: "Subjects Assigned", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllPersonel = async (req, res) => {
  try {
    const data = await personelSubjectModel.getAllPersonels();
    res.status(200).json({ data: data });
  } catch (error) {
    res.status(500).json(error);
  }
};

const getSubjects = async (req, res) => {
  try {
    let { sites, studies } = req.query;

    // Convert comma-separated strings to arrays if needed
    if (sites && !Array.isArray(sites)) {
      sites = sites.split(",").map((s) => s.trim());
    }
    if (studies && !Array.isArray(studies)) {
      studies = studies.split(",").map((s) => s.trim());
    }

    const data = await personelSubjectModel.getSubjectsBySitesStudies(
      sites,
      studies
    );
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAssignedSubjectsByPersonnelIdController = async (req, res) => {
  const { personnel_id } = req.params;
  try {
    const data = await personelSubjectModel.getAssignedSubjectsByPersonnelId(
      personnel_id
    );
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateAssignedSubjectsController = async (req, res) => {
  const { personnel_id, site_ids, study_ids, subject_ids } = req.body;
  if (
    site_ids.length !== study_ids.length ||
    site_ids.length !== subject_ids.length
  ) {
    return res
      .status(400)
      .json({ error: "All arrays must have the same length" });
  }
  try {
    const result = await personelSubjectModel.updateAssignedSubjects(
      personnel_id,
      site_ids,
      study_ids,
      subject_ids
    );
    res.status(200).json({ message: "Assignments updated", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPersonelSubjectController,
  getAllPersonel,
  getSubjects,
  getAssignedSubjectsByPersonnelIdController,
  updateAssignedSubjectsController,
};
