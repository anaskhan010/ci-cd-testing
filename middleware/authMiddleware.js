var jwt = require("jsonwebtoken");

const authMiddleware = (user) => {
  console.log("middleware", user);
  const token = jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      role_name: user.role_name,
    },
    "HJSDHDSLDLSDJSL",
    { expiresIn: "1d" }
  );

  return token;
};
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  console.log(token);

  if (!token) {
    return res.status(403).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    req.user = decoded;
    console.log("decoded", decoded);
    next();
  } catch (err) {
    return res.status(500).json({ message: "Failed to authenticate token." });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

module.exports = { authMiddleware, verifyToken, authorizeRoles };
