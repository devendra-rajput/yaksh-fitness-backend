const express = require('express');
const routes = express.Router();

/** Controllers **/
const equipmentsController = require("../resources/v1/equipments/equipments.controller");

/** Middleware **/
const authMiddleware = require("../middleware/v1/authorize");

routes.get('/', [authMiddleware.auth()], equipmentsController.getAll);

module.exports = routes;