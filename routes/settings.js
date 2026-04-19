const express = require('express');
const routes = express.Router();

/** Controllers **/ 
const settingController = require("../resources/v1/settings/settings.controller");

/** Middleware **/ 
const authMiddleware = require("../middleware/v1/authorize");

routes.get('/current', [ authMiddleware.auth() ], settingController.getCurrentSetting);

module.exports = routes;