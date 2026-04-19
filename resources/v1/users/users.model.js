/**
 * User Model
 * Data access layer for user operations.
 *
 * Design decisions:
 *  - All OTP operations happen in Redis (via otp.helpers.js), not here
 *  - Refresh tokens live in Redis (otp.helpers.js); only auth_token (legacy)
 *    kept here for backward compat during migration
 *  - Cache invalidated asynchronously (fire-and-forget) on mutations
 */

const { User, USER_STATUS, USER_ROLES } = require('./user.schema');
const { ONBOARDING_STEPS } = require('../../../constants/onboarding');

// eslint-disable-next-line global-require
const getDataHelper = () => require('../../../helpers/v1/data.helpers');
// eslint-disable-next-line global-require
const getRedisService = () => require('../../../services/redis');

/**
 * Common query conditions (frozen for safety)
 */
const COMMON_QUERIES = Object.freeze({
  notDeleted: { deleted_at: { $in: [null, '', ' '] } },
  collation: { locale: 'en', strength: 2 },
});

const CACHE_KEYS = Object.freeze({
  usersList: 'users:list:',
});

const createNotDeletedQuery = (extra = {}) => ({ ...COMMON_QUERIES.notDeleted, ...extra });

/* ─── Cache helpers ─────────────────────────────────────────────────────── */

const invalidateUserListCache = async () => {
  const redis = getRedisService();
  const keys = await redis.getAllSpecificKeys(CACHE_KEYS.usersList);
  if (keys && keys.length > 0) {
    await Promise.all(keys.map((k) => redis.clearKey(k)));
  }
};

/* ─── CRUD ──────────────────────────────────────────────────────────────── */

const createOne = async (data) => {
  try {
    if (!data) throw new Error('Data is required');
    const user = await User.create(data);
    if (!user) return false;
    invalidateUserListCache().catch(() => {});
    return user;
  } catch (error) {
    console.error('UserModel@createOne Error:', error.message);
    return false;
  }
};

/**
 * Find one user by any column.
 * @param {string} columnName
 * @param {*} columnValue
 * @param {boolean} includeSensitive - add password + auth_token selects
 */
const getOneByColumnNameAndValue = async (columnName, columnValue, includeSensitive = false) => {
  try {
    const query = createNotDeletedQuery({ [columnName]: columnValue });
    let qb = User.findOne(query).collation(COMMON_QUERIES.collation);
    if (includeSensitive) {
      qb = qb.select('+password +tokens.auth_token');
    }
    const result = await qb.lean({ virtuals: true });
    return result || false;
  } catch (error) {
    console.error('UserModel@getOneByColumnNameAndValue Error:', error.message);
    return false;
  }
};

/**
 * Find by google_id (for Google OAuth).
 */
const getOneByGoogleId = async (googleId) => {
  try {
    const query = createNotDeletedQuery({ google_id: googleId });
    const result = await User.findOne(query).lean({ virtuals: true });
    return result || false;
  } catch (error) {
    console.error('UserModel@getOneByGoogleId Error:', error.message);
    return false;
  }
};

const getOneByPhoneCodeAndNumber = async (phoneCode, phoneNumber, includeSensitive = false) => {
  try {
    let qb = User.findOne().byPhone(phoneCode, phoneNumber).collation(COMMON_QUERIES.collation);
    if (includeSensitive) qb = qb.select('+password +tokens.auth_token');
    const result = await qb.lean();
    return result || false;
  } catch (error) {
    console.error('UserModel@getOneByPhoneCodeAndNumber Error:', error.message);
    return false;
  }
};

const isUserExist = async (columnName, columnValue, excludeUserId = false) => {
  try {
    const query = createNotDeletedQuery({ [columnName]: columnValue });
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const count = await User.countDocuments(query).collation(COMMON_QUERIES.collation);
    return count > 0;
  } catch (error) {
    console.error('UserModel@isUserExist Error:', error.message);
    return false;
  }
};

const updateOne = async (id, data) => {
  try {
    if (!id || !data) throw new Error('ID and data are required');
    const user = await User.findByIdAndUpdate(id, data, { new: true, lean: true });
    if (!user) return false;
    invalidateUserListCache().catch(() => {});
    return user;
  } catch (error) {
    console.error('UserModel@updateOne Error:', error.message);
    return false;
  }
};

const deleteOne = async (id) => {
  try {
    const result = await User.deleteOne({ _id: id });
    if (!result || result.deletedCount === 0) return false;
    invalidateUserListCache().catch(() => {});
    return result;
  } catch (error) {
    console.error('UserModel@deleteOne Error:', error.message);
    return false;
  }
};

/* ─── Pagination ────────────────────────────────────────────────────────── */

const getAllWithPagination = async (page, limit, filterObj = {}) => {
  try {
    const redis = getRedisService();
    const dataHelper = getDataHelper();

    const cacheKey = `${CACHE_KEYS.usersList}page:${page}:limit:${limit}:role:${filterObj?.role || 'all'}`;
    const cached = await redis.getKey(cacheKey);
    if (cached) return cached;

    const query = createNotDeletedQuery(filterObj?.role ? { role: filterObj.role } : {});
    const totalRecords = await User.countDocuments(query);
    const pagination = dataHelper.calculatePagination(totalRecords, page, limit);

    const users = await User.aggregate([
      { $match: query },
      { $project: { password: 0, 'tokens.auth_token': 0 } },
      { $sort: { created_at: -1 } },
      { $skip: pagination.offset },
      { $limit: pagination.limit },
    ]);

    const result = {
      data: users || [],
      pagination: {
        total: totalRecords,
        current_page: pagination.currentPage,
        total_pages: pagination.totalPages,
        per_page: pagination.limit,
      },
    };

    redis.setKey(cacheKey, result).catch(() => {});
    return result;
  } catch (error) {
    console.error('UserModel@getAllWithPagination Error:', error.message);
    return false;
  }
};

/* ─── Formatting ────────────────────────────────────────────────────────── */

const getFormattedData = (userObj) => {
  if (!userObj) throw new Error('userObj is required');
  const dataHelper = getDataHelper();

  return {
    id: userObj._id,
    first_name: userObj?.user_info?.first_name || null,
    last_name: userObj?.user_info?.last_name || null,
    full_name: userObj?.full_name || null,
    email: userObj.email || null,
    role: userObj.role,
    status: userObj.status,
    phone_number: userObj.phone_number,
    phone_code: userObj.phone_code,
    profile_picture: userObj.profile_picture,
    is_email_verified: userObj.is_email_verified,
    onboarding_step: userObj.onboarding_step,
    dob: userObj.dob || null,
    height: userObj.height || null,
    height_unit: userObj.height_unit || null,
    weight: userObj.weight || null,
    weight_unit: userObj.weight_unit || null,
    gender: userObj.gender || null,
    goal: userObj.goal || null,
    fitness_level: userObj.fitness_level || null,
    training_location: userObj.training_location || null,
    equipments: userObj.equipments || [],
    activity_level: userObj.activity_level || null,
    has_google: !!userObj.google_id,
    created_at: dataHelper.convertDateTimezoneAndFormat(userObj.created_at),
    updated_at: dataHelper.convertDateTimezoneAndFormat(userObj.updated_at),
  };
};

module.exports = {
  createOne,
  getOneByColumnNameAndValue,
  getOneByGoogleId,
  getOneByPhoneCodeAndNumber,
  isUserExist,
  updateOne,
  deleteOne,
  getAllWithPagination,
  getFormattedData,
  statuses: USER_STATUS,
  roles: USER_ROLES,
  onboardingSteps: ONBOARDING_STEPS,
};
