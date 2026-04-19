const express = require('express');
const routes = express.Router();

/** Controllers **/
const exercisesController = require("../resources/v1/exercises/exercises.controller");
const exercisesValidation = require('../resources/v1/exercises/exercises.validation')

/** Middleware **/
const authMiddleware = require("../middleware/v1/authorize");

const uploadUtils = require("../utils/upload");

const dateObj = new Date();
const uploadDirectory = "uploads/exercises/" + dateObj.getFullYear() + "/" + (dateObj.getMonth() + 1) + "/" + dateObj.getDate();
const validFileExtenstions = /xlsx|xls|.csv/;
const maxFileSize = 100 * 1024 * 1024 // 100 MB

routes.post('/import', [authMiddleware.auth(), uploadUtils.uploadFile(validFileExtenstions, maxFileSize, uploadDirectory).single('file'),], exercisesController.importExercises);
routes.get('/all', [authMiddleware.auth()], exercisesController.getAll);
routes.get('/', [authMiddleware.auth()], exercisesController.getAllWithPagination);
routes.get('/generate', [authMiddleware.auth()], exercisesController.generateExercises);
routes.put('/generate-weekly-fitness-plan', [authMiddleware.auth(), exercisesValidation.generateWeeklyWorkoutPlan], exercisesController.generateWeeklyWorkoutPlan);

routes.put('/update-weekly-fitness-plan', [authMiddleware.auth(), exercisesValidation.updateWeeklyFitnessPlan], exercisesController.updateWeeklyFitnessPlan);

routes.patch('/exclude/:id', [authMiddleware.auth()], exercisesController.excludeExerciseForUser);

module.exports = routes;