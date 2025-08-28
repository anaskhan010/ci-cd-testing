// const express = require("express");
// const pagePermssionController = require("../../controllers/page_permission/pagePermissionController");
// const router = express.Router();

// router.post("/create_new_page", pagePermssionController.createPageController);

// router.get("/getallpages", pagePermssionController.getAllPages);

// router.post(
//   "/pegewithpermission",
//   pagePermssionController.submitPagePermissionController
// );

// // router.get(
// //   "/getpegewithpermission/:role_id",
// //   pagePermssionController.getSubmitPagewithPermissionController
// // );
// router.get(
//   "/getpegewithpermission/:user_id",
//   pagePermssionController.getSubmitPagewithPermissionController
// );

// router.put(
//   "/update_page_permission/:role_id",
//   pagePermssionController.updatePagePermissionController
// );

// router.get(
//   "/users-by-role/:role_id",
//   pagePermssionController.getUserByROLEIDController
// );

// router.get("/getallUsers", pagePermssionController.getAllUsersController);

// module.exports = router;

// const express = require("express");
// const pagePermssionController = require("../../controllers/page_permission/pagePermissionController");
// const router = express.Router();

// router.post("/create_new_page", pagePermssionController.createPageController);

// router.get("/getallpages", pagePermssionController.getAllPages);

// router.post(
//   "/pagewithpermission",
//   pagePermssionController.submitPagePermissionController
// );

// router.get(
//   "/getpagewithpermission/:study_id/:role_id",
//   pagePermssionController.getSubmitPagewithPermissionController
// );

// router.put(
//   "/update_page_permission/:study_id/:role_id",
//   pagePermssionController.updatePagePermissionController
// );

// module.exports = router;

// routes/page_permission.js
const express = require("express");
const pagePermssionController = require("../../controllers/page_permission/pagePermissionController");
const router = express.Router();

router.post("/create_new_page", pagePermssionController.createPageController);
router.get("/getallpages", pagePermssionController.getAllPages);
router.post(
  "/pagewithpermission",
  pagePermssionController.submitPagePermissionController
);
router.get(
  "/getpagewithpermission/:study_id/:role_id",
  pagePermssionController.getSubmitPagewithPermissionController
);
router.put(
  "/update_page_permission/:study_id/:role_id",
  pagePermssionController.updatePagePermissionController
);

// New endpoint for updating page order
router.put(
  "/update_page_order",
  pagePermssionController.updatePageOrderController
);

module.exports = router;
