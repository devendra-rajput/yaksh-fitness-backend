const response = require('../../../helpers/v1/response.helpers');
const { WeeklyPlan } = require('./schema');
const weeklyPlanModel = require('./model');
const { logger } = require('../../../utils/logger');

const getPlan = async (req, res) => {
  try {
    const plan = await WeeklyPlan.findOne({ user_id: req.user._id }).lean();
    return response.success('Weekly plan fetched', res, { plan: plan || null });
  } catch (error) {
    logger.error('WeeklyPlanController@getPlan Error:', { error: error.message });
    return response.exception('Failed to fetch weekly plan', res);
  }
};

const generatePlan = async (req, res) => {
  try {
    const preferences = req.body || {};
    const planData = await weeklyPlanModel.generate(req.user, preferences);
    const plan = await WeeklyPlan.findOneAndUpdate(
      { user_id: req.user._id },
      { ...planData, user_id: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return response.success('Weekly plan generated', res, { plan });
  } catch (error) {
    logger.error('WeeklyPlanController@generatePlan Error:', { error: error.message });
    return response.exception('Failed to generate weekly plan', res);
  }
};

const createManual = async (req, res) => {
  try {
    const preferences = req.body || {};
    const days = weeklyPlanModel.buildManualSkeleton(preferences);
    const plan = await WeeklyPlan.findOneAndUpdate(
      { user_id: req.user._id },
      {
        user_id: req.user._id,
        type: 'manual',
        status: 'draft',
        generated_at: new Date(),
        preferences: {
          difficulty: (preferences.difficulty || 'intermediate').toLowerCase(),
          duration_min: preferences.duration_min || 45,
          location: preferences.location || 'large_gym',
          days_per_week: preferences.days_per_week || 6,
          muscles: preferences.muscles || [],
        },
        days,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return response.success('Manual plan created', res, { plan });
  } catch (error) {
    logger.error('WeeklyPlanController@createManual Error:', { error: error.message });
    return response.exception('Failed to create manual plan', res);
  }
};

const updatePlan = async (req, res) => {
  try {
    const {
      days, preferences, status, type,
    } = req.body;
    const update = {};
    if (days) update.days = days;
    if (preferences) update.preferences = preferences;
    if (status) update.status = status;
    if (type) update.type = type;
    const plan = await WeeklyPlan.findOneAndUpdate(
      { user_id: req.user._id },
      update,
      { new: true },
    ).lean();
    if (!plan) return response.notFound('Plan not found', res);
    return response.success('Plan updated', res, { plan });
  } catch (error) {
    logger.error('WeeklyPlanController@updatePlan Error:', { error: error.message });
    return response.exception('Failed to update plan', res);
  }
};

const updateDay = async (req, res) => {
  try {
    const dayIndex = parseInt(req.params.dayIndex, 10);
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return response.badRequest('Invalid day index', res);
    const dayData = req.body;
    const plan = await WeeklyPlan.findOne({ user_id: req.user._id });
    if (!plan) return response.notFound('Plan not found', res);
    plan.days[dayIndex] = { ...plan.days[dayIndex].toObject?.() ?? plan.days[dayIndex], ...dayData, day_index: dayIndex };
    await plan.save();
    return response.success('Day updated', res, { plan: plan.toObject() });
  } catch (error) {
    logger.error('WeeklyPlanController@updateDay Error:', { error: error.message });
    return response.exception('Failed to update day', res);
  }
};

const regenerateDayHandler = async (req, res) => {
  try {
    const dayIndex = parseInt(req.params.dayIndex, 10);
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return response.badRequest('Invalid day index', res);
    const plan = await WeeklyPlan.findOne({ user_id: req.user._id });
    if (!plan) return response.notFound('Plan not found', res);
    const newDay = await weeklyPlanModel.regenerateDay(req.user, plan.toObject(), dayIndex);
    if (!newDay) return response.badRequest('Could not regenerate day', res);
    plan.days[dayIndex] = newDay;
    await plan.save();
    return response.success('Day regenerated', res, { plan: plan.toObject() });
  } catch (error) {
    logger.error('WeeklyPlanController@regenerateDay Error:', { error: error.message });
    return response.exception('Failed to regenerate day', res);
  }
};

const resetPlan = async (req, res) => {
  try {
    await WeeklyPlan.deleteOne({ user_id: req.user._id });
    return response.success('Plan reset', res, null);
  } catch (error) {
    logger.error('WeeklyPlanController@resetPlan Error:', { error: error.message });
    return response.exception('Failed to reset plan', res);
  }
};

module.exports = {
  getPlan, generatePlan, createManual, updatePlan, updateDay, regenerateDayHandler, resetPlan,
};
