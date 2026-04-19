const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');

class FavouriteValidation {
    
    /** Validate the create favourite data **/
    createOne = async (req, res, next) => {
        console.log('FavouriteValidation@createOne');

        let schema = {
            type: Joi.string().valid('meal', 'workout').required(),
            workout_id: Joi.string().when('type', {
                is: 'workout',
                then: Joi.string().required(),
                otherwise: Joi.forbidden()
            }),
            meal_id: Joi.string().when('type', {
                is: 'meal',
                then: Joi.string().required(),
                otherwise: Joi.forbidden()
            }),
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    getAllWithPagination = async (req, res, next) => {
        console.log('FavouriteValidation@getAllWithPagination');

        let schema = {
            type: Joi.string().valid('meal', 'workout').required(),
            page: Joi.number().required(),
            limit: Joi.number().required()
        }

        let errors = await dataHelper.joiValidation(req.query, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }
    
}

module.exports = new FavouriteValidation;
