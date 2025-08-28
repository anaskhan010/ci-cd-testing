const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

// Function to ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

// Custom transport that creates daily folders
class DailyFolderTransport extends transports.File {
  constructor(opts) {
    super(opts);
    this.filename = opts.filename;
  }

  get filename() {
    const today = moment().format("YYYY-MM-DD");

    const logsBaseDir = path.join(__dirname, "../Logs", today);
    ensureDirectoryExists(logsBaseDir);
    return path.join(logsBaseDir, this._filename);
  }

  set filename(filename) {
    this._filename = filename;
  }
}

// Create Winston logger
const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new DailyFolderTransport({
      filename: "error.log",
      level: "error",
      format: format.combine(format.timestamp(), format.json()),
    }),
    new DailyFolderTransport({
      filename: "combined.log",
      format: format.combine(format.timestamp(), format.json()),
    }),
  ],
});

// Add console transport for non-production environment
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}

module.exports = logger;
// const { createLogger, format, transports } = require("winston");

// const logger = createLogger({
//   level: "info",
//   format: format.combine(
//     format.timestamp({
//       format: "YYYY-MM-DD HH:mm:ss",
//     }),
//     format.errors({ stack: true }),
//     format.splat(),
//     format.json()
//   ),
//   //   defaultMeta: { service: "user-service" },
//   transports: [
//     new transports.File({ filename: "./Logs/error.log", level: "error" }),
//     new transports.File({ filename: "./Logs/combined.log" }),
//   ],
// });

// // If we're not in production then log to the console as well
// if (process.env.NODE_ENV !== "production") {
//   logger.add(
//     new transports.Console({
//       format: format.combine(format.colorize(), format.simple()),
//     })
//   );
// }

// module.exports = logger;
