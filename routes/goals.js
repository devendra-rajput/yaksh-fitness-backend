const express = require('express');
const routes = express.Router();

/** Controllers **/ 
const goalController = require("../resources/v1/goals/goals.controller");

/** Middleware **/ 
const authMiddleware = require("../middleware/v1/authorize");

routes.get('/', [ authMiddleware.auth() ], goalController.getAll);

module.exports = routes;