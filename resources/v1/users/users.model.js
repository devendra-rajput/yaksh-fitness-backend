/**
 * User Model
 * Data access layer for user operations
 */

const { User, USER_STATUS, USER_ROLES } = require('./user.schema');

// Lazy load dependencies only when needed
// eslint-disable-next-line global-require
const getDataHelper = () => require('../../../helpers/v1/data.helpers');
// eslint-disable-next-line global-require
const getRedisService = () => require('../../../services/redis');

/**
 * Common query conditions
 */
const COMMON_QUERIES = Object.freeze({
  notDeleted: {
    deleted_at: { $in: [null, '', ' '] },
  },
  caseInsensitive: {
    locale: 'en',
    strength: 2,
  },
});

/**
 * Cache key prefixes
 */
const CACHE_KEYS = Object.freeze({
  usersList: 'users:list:',
});

/**
 * Create query for non-deleted records
 */
const createNotDeletedQuery = (additionalQuery = {}) => ({
  ...COMMON_QUERIES.notDeleted,
  ...additionalQuery,
});

/**
 * Invalidate user list cache
 */
const invalidateUserListCache = async () => {
  const redis = getRedisService();
  const keys = await redis.getAllSpecificKeys(CACHE_KEYS.usersList);

  if (keys && keys.length > 0) {
    await Promise.all(keys.map((key) => redis.clearKey(key)));
  }
};

/**
 * Create a new user
 */
const createOne = async (data) => {
  try {
    if (!data) {
      throw new Error('Data is required');
    }

    const user = await User.create(data);
    if (!user) {
      return false;
    }

    // Invalidate cache asynchronously (fire and forget)
    invalidateUserListCache().catch(() => { });

    return user;
  } catch (error) {
    console.error('UserModel@createOne Error:', error.message);
    return false;
  }
};

/**
 * Get user by column name and value
 */
const getOneByColumnNameAndValue = async (columnName, columnValue, includeSensitive = false) => {
  try {
    const query = createNotDeletedQuery({ [columnName]: columnValue });

    let queryBuilder = User.findOne(query).collation(COMMON_QUERIES.caseInsensitive);

    // Include sensitive fields if requested
    if (includeSensitive) {
      queryBuilder = queryBuilder.select('+password +tokens.auth_token +otp.email_verification +otp.forgot_password');
    }

    const result = await queryBuilder.lean({ virtuals: true });

    return result || false;
  } catch (error) {
    console.error('UserModel@getOneByColumnNameAndValue Error:', error.message);
    return false;
  }
};

/**
 * Get user by phone code and number
 */
const getOneByPhoneCodeAndNumber = async (phoneCode, phoneNumber, includeSensitive) => {
  try {
    let queryBuilder = User.findOne().byPhone(phoneCode, phoneNumber)
      .collation(COMMON_QUERIES.caseInsensitive);

    // Include sensitive fields if requested
    if (includeSensitive) {
      queryBuilder = queryBuilder.select('+password +tokens.auth_token +otp.email_verification +otp.forgot_password');
    }

    const result = await queryBuilder.lean();

    return result || false;
  } catch (error) {
    console.error('UserModel@getOneByPhoneCodeAndNumber Error:', error.message);
    return false;
  }
};

/**
 * Check if user exists
 */
const isUserExist = async (columnName, columnValue, userId = false) => {
  try {
    const query = createNotDeletedQuery({ [columnName]: columnValue });

    if (userId) {
      query._id = { $ne: userId };
    }

    const count = await User.countDocuments(query)
      .collation(COMMON_QUERIES.caseInsensitive);

    return count > 0;
  } catch (error) {
    console.error('UserModel@isUserExist Error:', error.message);
    return false;
  }
};

/**
 * Update user by ID
 */
const updateOne = async (id, data) => {
  try {
    if (!id || !data) {
      throw new Error('ID and data are required');
    }

    const user = await User.findByIdAndUpdate(id, data, {
      new: true,
      lean: true, // Return plain JavaScript object
    });

    if (!user) {
      return false;
    }

    // Invalidate cache asynchronously
    invalidateUserListCache().catch(() => { });

    return user;
  } catch (error) {
    console.error('UserModel@updateOne Error:', error.message);
    return false;
  }
};

/**
 * Format user data for response
 */
const getFormattedData = (userObj) => {
  if (!userObj) {
    throw new Error('userObj is required');
  }

  const dataHelper = getDataHelper();

  return {
    id: userObj._id,
    first_name: userObj?.user_info?.first_name || null,
    last_name: userObj?.user_info?.last_name || null,
    full_name: userObj?.full_name || null,
    email: userObj.email,
    role: userObj.role,
    status: userObj.status,
    phone_number: userObj.phone_number,
    phone_code: userObj.phone_code,
    profile_picture: userObj.profile_picture,
    is_email_verified: userObj.is_email_verified,
    created_at: dataHelper.convertDateTimezoneAndFormat(userObj.created_at),
    updated_at: dataHelper.convertDateTimezoneAndFormat(userObj.updated_at),
    deleted_at: userObj.deleted_at,
  };
};

/**
 * Delete user by ID
 */
const deleteOne = async (id) => {
  try {
    const result = await User.deleteOne({ _id: id });

    if (!result || result.deletedCount === 0) {
      return false;
    }

    // Invalidate cache asynchronously
    invalidateUserListCache().catch(() => { });

    return result;
  } catch (error) {
    console.error('UserModel@deleteOne Error:', error.message);
    return false;
  }
};

/**
 * Get all users with pagination
 */
const getAllWithPagination = async (page, limit, filterObj = {}) => {
  try {
    const redis = getRedisService();
    const dataHelper = getDataHelper();

    // Create cache key
    const cacheKey = `${CACHE_KEYS.usersList}page:${page}:limit:${limit}:role:${filterObj?.role || 'all'}`;

    // Try to get from cache
    const cachedData = await redis.getKey(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Build query
    const query = createNotDeletedQuery(
      filterObj?.role ? { role: filterObj.role } : {},
    );

    // Get total count (optimized with hint if index exists)
    const totalRecords = await User.countDocuments(query);

    // Calculate pagination
    const pagination = dataHelper.calculatePagination(totalRecords, page, limit);

    // Fetch users with projection to exclude sensitive fields
    const users = await User.aggregate([
      { $match: query },
      {
        $project: {
          password: 0,
          'tokens.auth_token': 0,
          'tokens.fcm_token': 0,
        },
      },
      { $sort: { createdAt: -1 } },
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

    // Cache the result asynchronously
    redis.setKey(cacheKey, result).catch(() => { });

    return result;
  } catch (error) {
    console.error('UserModel@getAllWithPagination Error:', error.message);
    return false;
  }
};

/**
 * Export user model functions
 */
module.exports = {
  // CRUD operations
  createOne,
  getOneByColumnNameAndValue,
  getOneByPhoneCodeAndNumber,
  isUserExist,
  updateOne,
  deleteOne,
  getAllWithPagination,

  // Utility functions
  getFormattedData,

  // Constants
  statuses: USER_STATUS,
  roles: USER_ROLES,
};
