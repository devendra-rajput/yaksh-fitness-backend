/**
 * Workout Validation Middleware
 */

const Joi = require('joi');
const response = require('../../../helpers/v1/response.helpers');
const {
  WORKOUT_DIFFICULTY,
  WORKOUT_LOCATION,
  WORKOUT_TIME,
} = require('../../../constants/workout');

const generateSchema = Joi.object({
  session_type: Joi.string()
    .valid('strength', 'yoga', 'stretching', 'cardio')
    .default('strength'),

  // time is an integer (15 | 30 | 45 | 60) or the string 'custom'
  time: Joi.alternatives()
    .try(
      Joi.number().integer().valid(15, 30, 45, 60),
      Joi.string().valid(WORKOUT_TIME.CUSTOM),
    )
    .default(30),

  // custom_time: minutes as an integer, required only when time === 'custom'
  custom_time: Joi.number()
    .integer()
    .min(15)
    .max(120)
    .when('time', {
      is: WORKOUT_TIME.CUSTOM,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  difficulty: Joi.string()
    .valid(...Object.values(WORKOUT_DIFFICULTY))
    .default(WORKOUT_DIFFICULTY.INTERMEDIATE),

  location: Joi.string()
    .valid(...Object.values(WORKOUT_LOCATION))
    .default(WORKOUT_LOCATION.SMALL_GYM),

  muscles: Joi.array().items(Joi.string().trim()).default([]),

  full_body: Joi.boolean().default(false),

  circuit_preference: Joi.boolean().optional(),

  equipment_selected: Joi.array().items(Joi.string().trim()).optional(),
});

const generateWorkout = (req, res, next) => {
  const { error, value } = generateSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    const details = error.details.map((d) => d.message).join('; ');
    return response.validationError(details, res);
  }

  req.body = value;
  return next();
};

module.exports = { generateWorkout };
