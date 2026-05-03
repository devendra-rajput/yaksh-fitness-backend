const response = require('../../../helpers/v1/response.helpers');
const { FavouriteExercise } = require('./favourite_exercise.schema');
const { Exercise } = require('./exercise.schema');
const { logger } = require('../../../utils/logger');

const toggle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { exerciseId } = req.params;
    const existing = await FavouriteExercise.findOne({ user_id: userId, exercise_id: exerciseId });
    if (existing) {
      await FavouriteExercise.deleteOne({ _id: existing._id });
      return response.success('Removed from favourites', res, { is_favourite: false, exercise_id: exerciseId });
    }
    await FavouriteExercise.create({ user_id: userId, exercise_id: exerciseId });
    return response.created('Added to favourites', res, { is_favourite: true, exercise_id: exerciseId });
  } catch (error) {
    logger.error('FavouriteExerciseController@toggle Error:', { error: error.message });
    return response.exception('Failed to update favourite', res);
  }
};

const getIds = async (req, res) => {
  try {
    const userId = req.user._id;
    const favourites = await FavouriteExercise.find({ user_id: userId }).select('exercise_id').lean();
    const ids = favourites.map((f) => f.exercise_id.toString());
    return response.success('Favourites fetched', res, { ids });
  } catch (error) {
    logger.error('FavouriteExerciseController@getIds Error:', { error: error.message });
    return response.exception('Failed to fetch favourites', res);
  }
};

const list = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 12));
    const { search = '', difficulty = '', mechanic = '' } = req.query;

    const favs = await FavouriteExercise.find({ user_id: userId }).select('exercise_id').lean();
    const exerciseIds = favs.map((f) => f.exercise_id);

    const q = {
      _id: { $in: exerciseIds },
      status: 'published',
      deleted_at: { $in: [null, '', ' '] },
    };
    if (difficulty) q.difficulty = difficulty;
    if (mechanic) q.mechanic = mechanic;
    if (search.trim()) {
      q.title = { $regex: search.trim(), $options: 'i' };
    }

    const sortBy = { title: 1 };
    const selectFields = '_id title slug mechanic difficulty primary_muscles thumbnail_url video_url is_bodyweight equipment_category workout_split_category description instructions';

    const [exercises, total] = await Promise.all([
      Exercise.find(q)
        .select(selectFields)
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Exercise.countDocuments(q),
    ]);

    return response.success('Favourite exercises fetched', res, { exercises, total, page, limit });
  } catch (error) {
    logger.error('FavouriteExerciseController@list Error:', { error: error.message });
    return response.exception('Failed to fetch favourite exercises', res);
  }
};

module.exports = { toggle, getIds, list };
