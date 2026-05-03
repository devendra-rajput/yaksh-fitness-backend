const express = require('express');
const { auth } = require('../middleware/v1/authorize');
const favouriteController = require('../resources/v1/exercises/favourite_exercise.controller');

const router = express.Router();

router.get('/exercises/list', [auth()], favouriteController.list);
router.post('/exercises/:exerciseId', [auth()], favouriteController.toggle);
router.get('/exercises', [auth()], favouriteController.getIds);

module.exports = router;
