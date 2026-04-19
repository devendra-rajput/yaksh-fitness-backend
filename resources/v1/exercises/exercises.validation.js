const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const { locationFieldMap } = require('./exercises.model');
const { experienceLevels } = require('../users/users.model');

class ExercisesValidation {
    
    updateWeeklyFitnessPlan = async (req, res, next) => {
        console.log('ExercisesValidation@updateWeeklyFitnessPlan');

        let schema = {
            time: Joi.string().optional(),
            location: Joi.string().valid(...Object.keys(locationFieldMap)).optional(),
            muscles: Joi.string().optional(),
            difficulty: Joi.string().valid(...Object.values(experienceLevels)).optional(),
            specific_day: Joi.string().valid('1', '2', '3', '4', '5', '6', '7').required(),
            date: Joi.string().optional(),
            is_referesh: Joi.boolean().optional()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    generateWeeklyWorkoutPlan = async (req, res, next) => {
        console.log('ExercisesValidation@generateWeeklyWorkoutPlan');

        let schema = {
            // goal_id: Joi.string().optional().allow(""),
            difficulty: Joi.string().valid(...Object.values(experienceLevels)).optional().allow(""),
            equipment_ids: Joi.array().optional().items(
                Joi.string().optional()
            ),
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }    
}

module.exports = new ExercisesValidation;
