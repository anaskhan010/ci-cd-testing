// libss
var express = require("express");
var { rateLimit } = require("express-rate-limit");
var dotenv = require("dotenv");
var cors = require("cors");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var session = require("express-session");
var { checkPermission } = require("./middleware/permissionMiddleware.js");
const db = require("./config/DBConnection3.js");
// routes
var organizationRoutes = require("./routes/organization/organizationRoutes.js");
var authRoutes = require("./routes/auth/authRoutes.js");
var scheduleRoutes = require("./routes/schedules/scheduleRoutes.js");
var medicineRoutes = require("./routes/medication/medicineRoutes.js");
var patientVideoRoutes = require("./routes/patientVideos/patientVideoRoutes.js");
var roleRoutes = require("./routes/role/roleRoutes.js");
var incidentReportRoutes = require("./routes/incident_report/IncidentReportRoutes.js");
var appSurveyRoutes = require("./routes/app_survey/appSurveyRoutes.js");
var notiificationMiddleware = require("./middleware/notificationMIddleware.js");
const notificationRoutes = require("./routes/notification/notificationRoutes.js");
var registrationStatus = require("./routes/userRegistratonManagement/userRegistrationManagementRoutes.js");
const pageRoutes = require("./routes/pages/pageRoutes.js");
const permissionRoutes = require("./routes/permissions/permissionRoutes.js");
const userRolepagePermissionRoutes = require("./routes/user_role_page_permission/userRolePagePermissionRoutes.js");
const LogsRoutes = require("./routes/Logs/LogsRoutes.js");
const enhancedLogsRoutes = require("./routes/Logs/enhancedLogsRoutes.js");
const drinkRoutes = require("./routes/drink/drinkRoutes.js");
const studyEnrolledRoutes = require("./routes/study_enrolled/studyRoutes.js");
const CommonRoutes = require("./routes/CommonRoutes/commonRoutes.js");
const otherSurveyQuestionRoutes = require("./routes/othre_survey_Question/otherSurveyQuestionRoutes.js");
const VideoTermAndConditionRoutes = require("./routes/TermAndCondition/VideoTermAndConditionRoutes.js");
const Face_detectionRoutes = require("./routes/face_detection/Face_detectionRoutes.js");

const signWellRoutes = require("./routes/sign_well_routes/signWellRoutes.js");
const emergencyEmailRoutes = require("./routes/EmergencyEmailRoutes/emergencyEmailRoutes.js");
const pagePermissionRoute = require("./routes/page_permission/pagePermissionRoutes.js");

const scale_otp_route = require("./routes/Scale_OTP/scale_otp_route.js");
const ecrfRoutes = require("./routes/ecrf/ecrfRoutes.js");
const eventRoutes = require("./routes/event/eventRoute.js");
const newScaleRoutes = require("./routes/newScale/newScale.js");
const excelRoutes = require("./routes/excelRoutes/excelRoutes.js");
const dashboardChartRoutes = require("./routes/Charts/dashboardChartsRoutes.js");
const nonComplaintRoute = require("./routes/non_complaint/non_complaint_route.js");
const cron = require("node-cron");
const {
  checkDosageTimesAndSendReminder,
} = require("./controllers/medication/medicineController.js");
const {
  scheduleTask: scheduleExpiredStudiesCheck,
} = require("./scheduled_tasks/checkExpiredStudies.js");

const incidentReportController = require("./controllers/incident_report/incidentReportController.js");
const emailManagementRoute = require("./routes/emailManagementRoutes/emailManagementRoutes.js");
const {
  checkTokenMiddleware,
} = require("./middleware/CheckTokenMiddleware.js");
const azureAuthRoutes = require("./routes/azure_auth_route/azureAuthRoutes.js");
const reportRoute = require("./routes/reportsRoutes/reportsRoutes.js");
const personelSubjectRoutes = require("./routes/PersonelSubject/PersonelSubjectRoutes.js");
const pdfBarCodeRoute = require("./routes/pdfBarCode/pdfBarCodeRoutes.js");
const TLFB_Management_Routes = require("./routes/TLFB_Management/TLFB_Management_Routes.js");
const manual_api_calls_routes = require("./routes/manual_api_calls/manual_api_calls_routes.js");
const {startScaleStatusCron}  = require("./cronJobs/updateScaleStatus.js")
const { startLanguageDetectionCron } = require("./cronJobs/detectLanguage.job");

const helmet = require("helmet");
// config
dotenv.config({ path: "./config/Config.env" });

var app = express();

app.set('trust proxy', true);

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      // Allow all subdomains of research-hero.xyz to embed the resource.
      frameAncestors: ["'self'", "https://*.research-hero.xyz","https://myresearchhero.net"],
      // other directives as needed...
    },
  })
);
app.use(limiter);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

app.use(
  session({
    secret: "HJSDHDSLDLSDJSL",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.research-hero.xyz/ http://localhost:5173 https://myresearchhero.net/ https://myresearchhero.net "
  );
  next();
});

// Initialize Cron Job
startScaleStatusCron()
startLanguageDetectionCron();

cron.schedule("* * * * *", () => {
  console.log("cronjob running For Reminder email");
  checkDosageTimesAndSendReminder();
});

cron.schedule("0 0 9 * * 1", () => {
  console.log(
    "Running checkAndSendEmails  job for incident report pending tickets every week on Monday at 9 AM..."
  );
  incidentReportController.checkAndSendEmails();
});

app.use(express.static("public"));

// app.use("/enhanced-logs", require("./routes/Logs/enhancedLogsRoutes"));
app.use("/auth", authRoutes);
app.use("/organization", CommonRoutes);
app.use(checkTokenMiddleware);
app.use("/api_calls", manual_api_calls_routes);
app.use("/tlfb_file", TLFB_Management_Routes);
app.use("/pdf-bar-code", pdfBarCodeRoute);
app.use("/email_management", emailManagementRoute);
app.use("/report", reportRoute);
app.use("/permission", permissionRoutes);
app.use("/emergency", emergencyEmailRoutes);
app.use("/userRolePagePermission", userRolepagePermissionRoutes);
app.use("/role", roleRoutes);
app.use("/sign", signWellRoutes);
app.use("/scale-otp", scale_otp_route);
app.use("/ecrf", ecrfRoutes);
app.use("/events", eventRoutes);
app.use("/newScale", newScaleRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/page_permission", pagePermissionRoute);
app.use("/app_survey", appSurveyRoutes);
app.use("/azure-auth", azureAuthRoutes);
app.use("/charts", dashboardChartRoutes);
app.use("/complaint", nonComplaintRoute);
app.use("/personnel_subject", personelSubjectRoutes);

app.use("/logs", LogsRoutes);
app.use("/enhanced-logs", enhancedLogsRoutes);
app.use("/medicine", medicineRoutes);
app.use(checkPermission);
app.use("/organization", organizationRoutes);
app.use("/excel", excelRoutes);
app.use("/incident_report", incidentReportRoutes);
app.use("/page", pageRoutes);
app.use("/study", studyEnrolledRoutes);
app.use("/drink", drinkRoutes);

// Add video upload route
app.use("/patientVideo", patientVideoRoutes);
app.use("/notification", notificationRoutes);
app.use("/registration_approval", registrationStatus);
app.use("/otherSurvey", otherSurveyQuestionRoutes);
app.use("/videoTermAndCondition", VideoTermAndConditionRoutes);
app.use("/face_recongnition", Face_detectionRoutes);

app.listen(process.env.PORT, async () => {
  console.log("Server has started and is running on port " + process.env.PORT);
  try {
    // Test database connection
    const connection = await db.getConnection();
    console.log("MySQL Database connected successfully");
    connection.release(); // Release the connection back to the pool

    // Start the scheduled task to check for expired studies
    scheduleExpiredStudiesCheck();
  } catch (err) {
    console.error("Database connection error:", err);
  }
});
