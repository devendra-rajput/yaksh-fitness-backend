const Subscription = require("./subscriptions.schema");
const dataHelper = require('../../../helpers/v1/data.helpers');

// ─── Status Constants ────────────────────────────────────────────────────────
const ACTIVE = 'active';
const IN_GRACE = 'in_grace';
const ON_HOLD = 'on_hold';
const CANCELED = 'canceled';
const EXPIRED = 'expired';
const REFUNDED = 'refunded';
const SCHEDULED = 'scheduled'; // paid, not yet started (product change)

const statuses = Object.freeze({
    ACTIVE,
    IN_GRACE,
    ON_HOLD,
    CANCELED,
    EXPIRED,
    REFUNDED,
    SCHEDULED
});

// ─── Platform Constants (must match RevenueCat `store` field exactly) ────────
// RevenueCat sends "APP_STORE" for Apple and "PLAY_STORE" for Google.
// The old 'apple'/'google' values are removed to avoid confusion.
const APP_STORE = 'APP_STORE';   // Apple / iOS
const PLAY_STORE = 'PLAY_STORE';  // Google / Android

const platforms = Object.freeze({
    APP_STORE,
    PLAY_STORE
});

// ─── Plan Type Constants ─────────────────────────────────────────────────────
const YEARLY = 'YEARLY';
const MONTHLY = 'MONTHLY';
const UNKNOWN = 'UNKNOWN';

const planTypes = Object.freeze({
    YEARLY,
    MONTHLY,
    UNKNOWN
});

// ─── Model Class ─────────────────────────────────────────────────────────────
class SubscriptionModel {
    constructor() {
        this.statuses = statuses;
        this.platforms = platforms;
        this.planTypes = planTypes;
    }

    updateOne = async (id, data) => {
        console.log('SubscriptionModel@updateOne');

        try {
            if (!id || !data) {
                throw new Error('id and data are required');
            }

            const subscription = await Subscription.findByIdAndUpdate(id, data, { new: true });
            return subscription || false;

        } catch (error) {
            console.log("Error SubscriptionModel@updateOne: ", error);
            return false;
        }
    }

    findOneAndUpdate = async (whereCondition, data, options = {}) => {
        console.log('SubscriptionModel@findOneAndUpdate');

        try {
            if (!Object.keys(whereCondition).length || !Object.keys(data).length) {
                throw new Error('whereCondition and data are required');
            }

            const queryOptions = { new: true, ...options };
            const subscription = await Subscription.findOneAndUpdate(whereCondition, data, queryOptions);
            return subscription || false;

        } catch (error) {
            console.log("Error SubscriptionModel@findOneAndUpdate: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('SubscriptionModel@getOneByColumnNameAndValue');

        try {
            const { status } = filterObj;

            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: { $in: [null, '', ' '] }
            };

            if (status) {
                dbQuery.status = status;
            }

            const result = await Subscription.findOne(dbQuery)
                .collation({ locale: 'en', strength: 2 });
            return result || false;

        } catch (error) {
            console.log("Error SubscriptionModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    /**
     * DB-level idempotency check: returns true if the rc_event_id already exists.
     */
    isEventAlreadyProcessed = async (rcEventId) => {
        console.log('SubscriptionModel@isEventAlreadyProcessed');

        try {
            const existing = await Subscription.exists({ rc_event_id: rcEventId });
            return !!existing;
        } catch (error) {
            console.log("Error SubscriptionModel@isEventAlreadyProcessed: ", error);
            return false;
        }
    }

    /**
     * Atomic upsert: finds one document matching `matchFilter` and updates it
     * with `setData`. If no document matches, creates a new one containing
     * both `setData` and `setOnInsertData`.
     *
     * This is the core primitive that prevents sync ↔ webhook race conditions:
     *
     *   • `matchFilter`     — uniquely identifies the subscription record
     *                         (e.g. { user_id, subscription_id })
     *   • `setData`         — fields always written (status, period dates, …)
     *   • `setOnInsertData` — fields written ONLY on INSERT (e.g. rc_event_id,
     *                         so a sync-created record doesn't lose its webhook
     *                         event ID on the next sync update)
     *
     * Race condition scenarios handled:
     *   Sync first → Webhook later : upsert finds sync record, patches rc_event_id via $setOnInsert=no-op
     *   Webhook first → Sync later : upsert finds webhook record, patches status/dates
     *   Duplicate webhook          : isEventAlreadyProcessed() catches it before we get here
     *
     * @param {object} matchFilter      - Mongoose find condition
     * @param {object} setData          - Fields to $set on every write
     * @param {object} [setOnInsertData={}] - Fields to $setOnInsert (create-only)
     * @returns {mongoose.Document|false}
     */
    upsertSubscription = async (matchFilter, setData, setOnInsertData = {}) => {
        console.log('SubscriptionModel@upsertSubscription');

        try {
            const update = { $set: setData };
            if (Object.keys(setOnInsertData).length > 0) {
                update.$setOnInsert = setOnInsertData;
            }

            const result = await Subscription.findOneAndUpdate(
                matchFilter,
                update,
                {
                    upsert: true,
                    new: true,
                    runValidators: false // skip required-field validation on partial updates
                }
            );
            return result || false;

        } catch (error) {
            // E11000 = duplicate key — two concurrent requests raced on the same insert.
            // The other request won; find and return the winner's document.
            if (error.code === 11000) {
                console.warn('SubscriptionModel@upsertSubscription: duplicate key race — fetching existing document');
                return await Subscription.findOne(matchFilter) || false;
            }
            console.log("Error SubscriptionModel@upsertSubscription: ", error);
            return false;
        }
    }

    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('SubscriptionModel@getAllWithPagination');

        try {
            let dbQuery = {
                deleted_at: { $in: [null, '', ' '] },
            };

            if (filterObj?.status) {
                dbQuery.status = filterObj.status;
            }

            const totalRecords = await Subscription.countDocuments(dbQuery);
            const pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            const subscriptions = await Subscription.find({ ...dbQuery }, { __v: 0 })
                .sort({ created_at: -1 })
                .skip(pagination.offset)
                .limit(pagination.limit);

            const resObj = {
                data: subscriptions || [],
                pagination: {
                    total: totalRecords,
                    current_page: pagination.currentPage,
                    total_pages: pagination.totalPages,
                    per_page: pagination.limit
                }
            };

            return resObj;

        } catch (error) {
            console.log("Error SubscriptionModel@getAllWithPagination: ", error);
            return false;
        }
    }

    createOne = async (data) => {
        console.log('SubscriptionModel@createOne');

        try {
            if (!data) {
                throw new Error('Data is required');
            }

            const result = await Subscription.create(data);
            return result || false;

        } catch (error) {
            console.log("Error SubscriptionModel@createOne: ", error);
            return false;
        }
    }

    getAllSubscriptions = async (filterObj = {}) => {
        console.log('SubscriptionModel@getAllSubscriptions');

        try {
            let dbQuery = {
                deleted_at: { $in: [null, '', ' '] }
            };

            // Accept a plain status string OR a Mongoose operator object ({ $in: [...] })
            if (filterObj?.status !== undefined && filterObj?.status !== null) {
                dbQuery.status = filterObj.status;
            }

            const result = await Subscription.find(dbQuery)
                .collation({ locale: 'en', strength: 2 });
            return result || [];

        } catch (error) {
            console.log("Error SubscriptionModel@getAllSubscriptions: ", error);
            return [];
        }
    }
}

module.exports = new SubscriptionModel;
