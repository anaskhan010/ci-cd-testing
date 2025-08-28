const azureAuthService = require("../../services/azureAuthService");

async function getGraphAccessToken(req, res) {
  try {
    const token = await azureAuthService.getAccessTokenForGraph();

    if (!token) {
      return res.status(500).json({
        error: "Failed to retrieve access token. Please try again later.",
      });
    }

    res.json({ accessToken: token });
  } catch (error) {
    console.error("Error retrieving access token:", error.message);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
}

module.exports = {
  getGraphAccessToken,
};
