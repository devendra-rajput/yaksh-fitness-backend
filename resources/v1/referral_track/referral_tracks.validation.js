const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const ReferralTrackModel = require('./referral_tracks.model');
const UserModel = require('../users/users.model')

class ReferralTrackValidation {
  
  getAllWithPagination = async (req, res, next) => {
    console.log('ReferralTrackValidation@getAllWithPagination');

    let schema = {
      page: Joi.number().required(),
      limit: Joi.number().required(),
      status: Joi.string().valid(...Object.values(ReferralTrackModel.statuses)).optional()
    }

    let errors = await dataHelper.joiValidation(req.query, schema);
    if (errors?.length) {
      return response.validationError(errors[0], res, errors);
    }

    next();
  }

  getAllWithPaginationForAdmin = async (req, res, next) => {
    console.log('ReferralTrackValidation@getAllWithPaginationForAdmin');

    let schema = {
      page: Joi.number().required(),
      limit: Joi.number().required(),
      referrer_id: Joi.string().optional(),
      status: Joi.string().valid(...Object.values(ReferralTrackModel.statuses)).optional()
    }

    let errors = await dataHelper.joiValidation(req.query, schema);
    if (errors?.length) {
      return response.validationError(errors[0], res, errors);
    }

    next();
  }

  initiateReferralPayout = async (req, res, next) => {
    console.log('ReferralTrackValidation@initiateReferralPayout');

    const schema = Joi.object({
                    referred_by: Joi.string(),
                    referral_track_ids: Joi.array()
                  }).or('referred_by', 'referral_track_ids')

    let errors = await dataHelper.joiValidation(req.body, schema);
    if (errors?.length) {
      return response.validationError(errors[0], res, errors);
    }

    // Validate referred by id
    if (req.body.referred_by) {
      const isUserExist = await UserModel.getOneByColumnNameAndValue("_id", req.body.referred_by)
      if (!isUserExist) {
        return response.badRequest("error.referredByUserNotFound", res, false)
      }
    }

    let referrerId;

    // Validate referral track ids
    if (req.body?.referral_track_ids?.length) {
      const referralTrackIds = req.body.referral_track_ids;
      const referralTracks = await ReferralTrackModel.getAll({ids: referralTrackIds});
      let errorMessage = `error.referralTrackIdNotFound`
      if(!referralTracks?.length || referralTracks?.length !== referralTrackIds?.length) {
        return response.badRequest(errorMessage, res, false)
      }

      // Check if all the records belongs to the same referrer
      referrerId = referralTracks[0].referrer_id.toString();
      const isSameReferrer = referralTracks.every(referral => referral.referrer_id.toString() === referrerId);
      if (!isSameReferrer) {
        return response.badRequest(`error.differentReferrerIds`, res, false);
      }
    }

    req.referrerId = req.body.referred_by ? req.body.referred_by: referrerId
    next();
  }

}

module.exports = new ReferralTrackValidation;