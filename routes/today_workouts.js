const express = require('express');
const routes = express.Router();

/** Controllers **/ 
const todayWorkoutController = require("../resources/v1/today_workouts/today_workouts.controller");

/** Validations **/ 
const todayWorkoutValidation = require("../resources/v1/today_workouts/today_workouts.validation");

/** Middleware **/ 
const authMiddleware = require("../middleware/v1/authorize");

routes.get('/', [ authMiddleware.auth() ], todayWorkoutController.getTodayWorkouts);
routes.post('/sets', [ authMiddleware.auth(), todayWorkoutValidation.createWorkoutSets ], todayWorkoutController.createWorkoutSets);
routes.post('/add-exercise', [ authMiddleware.auth(), todayWorkoutValidation.addExercise ], todayWorkoutController.addExercise);
routes.post('/replace-exercise', [ authMiddleware.auth(), todayWorkoutValidation.replaceExercise ], todayWorkoutController.replaceExercise);
routes.patch('/complete', [ authMiddleware.auth() ], todayWorkoutController.completeTodayWorkout);

module.exports = routes;