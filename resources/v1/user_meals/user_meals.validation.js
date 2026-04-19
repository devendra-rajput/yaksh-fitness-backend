const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');

class UserMealValidation {
    
    /** Validate the create user meal data **/
    // Backup
    // createOne = async (req, res, next) => {
    //     console.log('UserMealValidation@createOne');

    //     let schema = {
    //         scan_id: Joi.string().optional(),
    //         food_name: Joi.string().optional(),
    //         calories: Joi.number().required(),
    //         protien: Joi.number().required(),
    //         fats: Joi.number().required(),
    //         carbs: Joi.number().required(),
    //         quality_rating: Joi.number().optional(),
    //         quality_rating_title: Joi.string().optional(),
    //         quantity: Joi.number().required()
    //     }

    //     let errors = await dataHelper.joiValidation(req.body, schema);
    //     if (errors?.length) {
    //         return response.validationError(errors[0], res, errors);
    //     }

    //     next();
    // }

    // createOne = async (req, res, next) => {
    //     console.log('UserMealValidation@createOne');

    //     let schema = {
    //         meals: Joi.array().min(1).required().items(
    //             Joi.object().keys({
    //                 recognised_food_name: Joi.string().optional(),
    //                 food_name: Joi.string().optional(),
    //                 food_type: Joi.string().optional(),
    //                 nutrition: Joi.object().keys({
    //                     fiber: Joi.number().optional().allow(""),
    //                     fat: Joi.number().optional().allow(""),
    //                     carbs: Joi.number().optional().allow(""),
    //                     protein: Joi.number().optional().allow(""),
    //                     calories: Joi.number().optional().allow(""),
    //                     weight_qty: Joi.number().optional().allow(""), // Like as 20 grm fiber
    //                     weight_unit: Joi.string().optional().allow(""),
    //                     serving_qty: Joi.number().optional().allow(""), // Like as 2 slice or cup
    //                     serving_unit: Joi.string().optional().allow("")
    //                 }),
    //                 score: Joi.number().optional().allow(""),
    //                 brand_name: Joi.string().optional().allow(""),
    //                 tags: Joi.array().optional(),
    //                 weight_grams: Joi.number().optional().allow(""),
    //                 portion_size: Joi.string().optional().allow(""), // Like piece or cup
    //                 meal_time: Joi.string().optional().allow(""), // Lunch, Dinner, Breakfast
    //                 consumed_qty: Joi.number().optional().allow("")
    //             })
    //         )
    //     }

    //     let errors = await dataHelper.joiValidation(req.body, schema);
    //     if (errors?.length) {
    //         return response.validationError(errors[0], res, errors);
    //     }

    //     next();
    // }
    
}

module.exports = new UserMealValidation;
