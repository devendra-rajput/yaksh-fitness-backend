const response = require('../../../helpers/v1/response.helpers');
const {
  createSession, getActive, updateSession, completeSession, getHistory,
} = require('./model');
const { logger } = require('../../../utils/logger');

const start = async (req, res) => {
  try {
    const session = await createSession(req.user._id, req.body);
    if (!session) return response.exception('Failed to start workout session', res);
    return response.created('Session started', res, session);
  } catch (error) {
    logger.error('WorkoutSessionController@start Error:', { error: error.message });
    return response.exception('Failed to start session', res);
  }
};

const active = async (req, res) => {
  try {
    const session = await getActive(req.user._id);
    return response.success('Active session fetched', res, session);
  } catch (error) {
    logger.error('WorkoutSessionController@active Error:', { error: error.message });
    return response.exception('Failed to fetch active session', res);
  }
};

const update = async (req, res) => {
  try {
    const session = await updateSession(req.user._id, req.params.id, req.body);
    if (!session) return response.notFound('Session not found', res);
    return response.success('Session updated', res, session);
  } catch (error) {
    logger.error('WorkoutSessionController@update Error:', { error: error.message });
    return response.exception('Failed to update session', res);
  }
};

const complete = async (req, res) => {
  try {
    const session = await completeSession(req.user._id, req.params.id);
    if (!session) return response.notFound('Session not found or already completed', res);
    return response.success('Workout completed! Great job!', res, session);
  } catch (error) {
    logger.error('WorkoutSessionController@complete Error:', { error: error.message });
    return response.exception('Failed to complete session', res);
  }
};

const abandon = async (req, res) => {
  try {
    const session = await updateSession(req.user._id, req.params.id, {
      status: 'abandoned',
      completed_at: new Date(),
    });
    if (!session) return response.notFound('Session not found', res);
    return response.success('Session abandoned', res);
  } catch (error) {
    logger.error('WorkoutSessionController@abandon Error:', { error: error.message });
    return response.exception('Failed to abandon session', res);
  }
};

const history = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await getHistory(req.user._id, page, limit);
    if (!data) return response.exception('Failed to fetch history', res);
    return response.success('History fetched', res, data);
  } catch (error) {
    logger.error('WorkoutSessionController@history Error:', { error: error.message });
    return response.exception('Failed to fetch history', res);
  }
};

module.exports = {
  start, active, update, complete, abandon, history,
};
