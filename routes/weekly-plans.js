const express = require('express');
const { auth } = require('../middleware/v1/authorize');
const ctrl = require('../resources/v1/weekly-plans/controller');

const router = express.Router();

router.get('/', [auth()], ctrl.getPlan);
router.post('/generate', [auth()], ctrl.generatePlan);
router.post('/manual', [auth()], ctrl.createManual);
router.put('/', [auth()], ctrl.updatePlan);
router.put('/days/:dayIndex', [auth()], ctrl.updateDay);
router.post('/days/:dayIndex/regenerate', [auth()], ctrl.regenerateDayHandler);
router.delete('/', [auth()], ctrl.resetPlan);

module.exports = router;
