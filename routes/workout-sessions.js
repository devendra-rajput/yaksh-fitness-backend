const express = require('express');
const sessionController = require('../resources/v1/workout-sessions/controller');
const { auth } = require('../middleware/v1/authorize');

const router = express.Router();

router.post('/start', [auth()], sessionController.start);
router.get('/active', [auth()], sessionController.active);
router.get('/history', [auth()], sessionController.history);
router.put('/:id', [auth()], sessionController.update);
router.post('/:id/complete', [auth()], sessionController.complete);
router.post('/:id/abandon', [auth()], sessionController.abandon);

module.exports = router;
