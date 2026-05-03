const express = require('express');
const workoutController = require('../resources/v1/workouts/workout.controller');
const workoutValidation = require('../resources/v1/workouts/workout.validation');
const { auth } = require('../middleware/v1/authorize');

const router = express.Router();

router.post(
  '/generate',
  [auth(), workoutValidation.generateWorkout],
  workoutController.generate,
);

module.exports = router;
