const express = require('express');
const routes = express.Router();

/** Controllers **/
const userStreakController = require("../resources/v1/user_streaks/user_streaks.controller");

/** Middleware **/
const authMiddleware = require("../middleware/v1/authorize");

/** Routes **/
routes.get('/', [authMiddleware.auth()], userStreakController.getStreak);
routes.put('/update', [authMiddleware.auth()], userStreakController.updateStreak);

module.exports = routes;
