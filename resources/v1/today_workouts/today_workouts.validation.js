const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');

class TodayWorkoutValidation {

    /** Validate to create workout sets data **/
    createWorkoutSets = async (req, res, next) => {
        console.log('TodayWorkoutValidation@createWorkoutSets');

        let schema = {
            exercise_id: Joi.string().required(),
            set_and_reps: Joi.object().keys({
                            sets: Joi.string().optional(),
                            reps: Joi.string().optional(),
                            weight: Joi.string().optional(),
                            weight_unit: Joi.string().optional()
                        }).optional()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate to add exercise data **/
    addExercise = async (req, res, next) => {
        console.log('TodayWorkoutValidation@addExercise');

        let schema = {
            exercises: Joi.array().min(1).items(
                            Joi.object()
                        ).required(),
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate to add exercise data **/
    replaceExercise = async (req, res, next) => {
        console.log('TodayWorkoutValidation@replaceExercise');

        let schema = {
            exercise_id: Joi.string().required(),
            replace_with: Joi.object().required(),
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

}

module.exports = new TodayWorkoutValidation;
