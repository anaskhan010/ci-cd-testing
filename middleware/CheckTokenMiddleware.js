// // middleware/checkToken.js

// const jwt = require("jsonwebtoken");

// const checkTokenMiddleware = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     if (!token) {
//       return res.status(404).json({ message: "Not Found: Token missing." });
//     }

//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

//     req.user = decoded;

//     next();
//   } catch (error) {
//     return res
//       .status(401)
//       .json({ error, message: "Unauthorized: Invalid token." });
//   }
// };

// module.exports = { checkTokenMiddleware };

// middleware/checkToken.js
const jwt = require("jsonwebtoken");

const checkTokenMiddleware = async (req, res, next) => {
  try {
    // Try to get the token from the Authorization header first
    let token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];

    // If not found, check for a token in the query parameters
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(404).json({ message: "Not Found: Token missing." });
    }

    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    req.user = decoded;

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ error, message: "Unauthorized: Invalid token." });
  }
};

module.exports = { checkTokenMiddleware };
