const Organization = require("../../models/organization/organizationModel");
const { compareFaces } = require("../../middleware/faceDetectionService");
const path = require("path");

exports.matchOrganizationImage = async (req, res) => {
  const { user_id } = req.body;
  const uploadedImage = req.file ? req.file.path : null;

  if (!uploadedImage) {
    return res.status(400).send({ message: "No image uploaded" });
  }

  try {
    const result = await Organization.getOrganizationById(user_id, user_id);

    if (!result) {
      return res.status(404).send({ message: "Organization not found" });
    }

    const storedImagePath = path.join(__dirname, "../../public", result.image);

    console.log("Stored Image Path:", storedImagePath);
    console.log("Uploaded Image Path:", uploadedImage);

    try {
      const match = await compareFaces(storedImagePath, uploadedImage);

      if (match) {
        res.status(200).send({ message: "Your identity has been verified" });
      } else {
        res
          .status(401)
          .send({ message: "Your identity is not verified please Re-try" });
      }
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error comparing faces", error: error.message });
    }
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error retrieving organization", error: error.message });
  }
};
