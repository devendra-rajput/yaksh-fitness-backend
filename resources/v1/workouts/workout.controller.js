/**
 * Workout Controller
 * Handles HTTP requests for AI workout generation.
 * Reads gender, age, weight, height, goal, and activity_level from req.user
 * (set by auth middleware) so the client never needs to send profile data.
 */

const response = require('../../../helpers/v1/response.helpers');
const { generateWorkout } = require('./workout.model');
const { logger } = require('../../../utils/logger');

const generate = async (req, res) => {
  try {
    const {
      session_type,
      time,
      custom_time,
      difficulty,
      location,
      muscles,
      full_body,
      circuit_preference: circuit_pref_override,
      equipment_selected,
    } = req.body;

    // Build user profile snapshot from the authenticated user record
    const user = req.user || {};
    const userProfile = {
      user_id: user._id || null,
      gender: user.gender || 'Prefer not to say',
      dob: user.dob || null,
      weight: user.weight || null,
      weight_unit: user.weight_unit || 'kg',
      height: user.height || null,
      height_unit: user.height_unit || 'cm',
      goal: user.goal || 'Stay Active',
      fitness_level: user.fitness_level || 'Intermediate',
      activity_level: user.activity_level || 'Moderately Active',
      injuries: user.injuries || [],
      pregnancy_trimester: user.pregnancy_trimester || null,
      circuit_preference: circuit_pref_override !== undefined ? circuit_pref_override : (user.circuit_preference || false),
      split_preference: user.split_preference || 'ppl',
      tempo_display: user.tempo_display !== undefined ? user.tempo_display : null,
    };

    const workout = await generateWorkout({
      session_type,
      time,
      custom_time,
      difficulty,
      location,
      muscles,
      full_body,
      equipment_selected: location === 'custom' ? (equipment_selected || []) : [],
      user_profile: userProfile,
    });

    if (!workout) {
      return response.exception('Failed to generate workout', res);
    }

    return response.success('Workout generated successfully', res, workout);
  } catch (error) {
    logger.error('WorkoutController@generate Error:', { error: error.message });
    return response.exception('Failed to generate workout', res);
  }
};

module.exports = { generate };
