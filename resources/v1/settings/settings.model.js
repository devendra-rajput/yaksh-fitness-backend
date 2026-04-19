/** Custom Require **/ 
const Setting = require('./setting.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');

class SettingModel {

    constructor() {
        // 
    }

    getCurrentSetting = async () => {
        console.log('SettingModel@getCurrentSetting');

        try {
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await Setting.findOne(dbQuery)
                                    .sort({created_at: -1})
                                    .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error SettingModel@getCurrentSetting: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('SettingModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let setting = await Setting.findByIdAndUpdate(id, data, { new: true })
            if (!setting) {
                return false;
            }

            return setting;

        } catch (error) {
            console.log("Error SettingModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("SettingModel@deleteOne");

        try {
            let result = await Setting.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error SettingModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('SettingModel@getAll');

        try {
            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            let settings = await Setting.aggregate([
                                                { $match: dbQuery}
                                            ])
                                            .sort({ title: 1});
            
            if (!settings) {
                results = [];
            }
            else {
                results = settings;
            }

            return results;

        } catch (error) {
            console.log("Error SettingModel@getAll: ", error);
            return [];
        }
            
    }
}

module.exports =  new SettingModel;
