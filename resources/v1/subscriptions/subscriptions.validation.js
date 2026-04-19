const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const SubscriptionModel = require("./subscriptions.model");

class SubscriptionValidation {

  // /** Validate the create user data **/
  // createOne = async (req, res, next) => {
  //   console.log('UsersValidation@createOne');
    
  //   let schema = {
  //     platform: Joi.string().valid(SubscriptionModel.platforms.APPLE, SubscriptionModel.platforms.GOOGLE).required(),
  //     product_id: Joi.string().required(),
  //     level: Joi.number().integer().required(),
      
  //     // Apple Validation
  //     original_transaction_id: Joi.when("platform", {
  //       is: SubscriptionModel.platforms.APPLE,
  //       then: Joi.string().required(),
  //       otherwise: Joi.forbidden()
  //     }),
  //     app_account_token: Joi.string().optional(),
    
  //     // Google Validation
  //     purchase_token: Joi.when("platform", {
  //       is: SubscriptionModel.platforms.GOOGLE,
  //       then: Joi.string().required(),
  //       otherwise: Joi.forbidden()
  //     }),
  //     subscription_id: Joi.when("platform", {
  //       is: SubscriptionModel.platforms.GOOGLE,
  //       then: Joi.string().required(),
  //       otherwise: Joi.forbidden()
  //     }),
  //     package_name: Joi.when("platform", {
  //       is: SubscriptionModel.platforms.GOOGLE,
  //       then: Joi.string().required(),
  //       otherwise: Joi.forbidden()
  //     }),
  //     obfuscated_account_id: Joi.string().optional()
  //   }

  //   let errors = await dataHelper.joiValidation(req.body, schema);
  //   if (errors?.length) {
  //     return response.validationError(errors[0], res, errors);
  //   }

  //   next();
  // }
  
  getAllWithPagination = async (req, res, next) => {
    console.log('UsersValidation@getAllWithPagination');

    let schema = {
      status : Joi.string().valid(SubscriptionModel.statuses.ACTIVE, SubscriptionModel.statuses.CANCELED, SubscriptionModel.statuses.EXPIRED, SubscriptionModel.statuses.IN_GRACE, SubscriptionModel.statuses.IN_GRACE, SubscriptionModel.statuses.ON_HOLD, SubscriptionModel.statuses.REFUNDED)
    }
    let errors = await dataHelper.joiValidation(req.body, schema);
    if (errors?.length) {
        return response.validationError(errors[0], res, errors);
    }
    
    next();
  }
  
}

module.exports = new SubscriptionValidation;