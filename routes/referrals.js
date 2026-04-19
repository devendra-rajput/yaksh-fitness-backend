const express = require('express');
const routes = express.Router();

const { roles: userRoles } = require('../resources/v1/users/users.model');

/** Controllers **/ 
const referralController = require('../resources/v1/referral_track/referral_tracks.controller');

/** Validations **/ 
const referralValidation = require("../resources/v1/referral_track/referral_tracks.validation");

/** Middleware **/ 
const authMiddleware = require("../middleware/v1/authorize");

routes.get('/', [ authMiddleware.auth(), referralValidation.getAllWithPagination ], referralController.getAllWithPagination);
routes.get('/admin', [ authMiddleware.auth(), referralValidation.getAllWithPaginationForAdmin ], referralController.getAllWithPaginationForAdmin);
routes.post('/initiate/payout', [ authMiddleware.auth(userRoles.ADMIN), referralValidation.initiateReferralPayout ], referralController.initiateReferralPayout);
routes.post('/confirm/payout', [ authMiddleware.auth(userRoles.ADMIN), referralValidation.initiateReferralPayout ], referralController.confirmReferralPayout);

module.exports = routes;