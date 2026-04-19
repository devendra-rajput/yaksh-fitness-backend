const mongoose = require("mongoose");
const moment = require('moment-timezone')

/** Custom Require **/
const Payouts = require('./payouts.schema');

const FAILED = 'failed'
const STRIPE_ERROR = 'stripe_error'
const PENDING = 'pending';
const PAID = 'paid';
const PayoutStatuses = Object.freeze({ PENDING, FAILED, PAID, STRIPE_ERROR })

class PayoutsModel {

    constructor() {
        this.PayoutStatuses = PayoutStatuses
    }

    createOne = async (data) => {
        console.log('PayoutsModel@createOne');
        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the language data 
            let result = await Payouts.create(data);
            if (!result) {
                return false;
            }
            return result;
        } catch (error) {
            console.log("Error PayoutsModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('PayoutsModel@getOneByColumnNameAndValue');

        try {

            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await Payouts.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error PayoutsModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }



}

module.exports = new PayoutsModel;
