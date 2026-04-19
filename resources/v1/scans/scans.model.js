const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const moment = require('moment-timezone')

/** Custom Require **/
const Scan = require('./scan.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');
const UserModel = require('../users/users.model');

const FOOD = 'food';
const BODY = 'body';
const scanTypes = Object.freeze({ FOOD, BODY });

class ScanModel {

    constructor() {
        this.scanTypes = scanTypes;
    }

    createOne = async (data) => {
        console.log('ScanModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the scan data 
            let scan = await Scan.create(data);
            if (!scan) {
                return false;
            }

            return scan;

        } catch (error) {
            console.log("Error ScanModel@createOne: ", error);
            return false;
        }

    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('ScanModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await Scan.findOne(dbQuery)
                .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error ScanModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('ScanModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let scan = await Scan.findByIdAndUpdate(id, data, { new: true })
            if (!scan) {
                return false;
            }

            return scan;

        } catch (error) {
            console.log("Error ScanModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("ScanModel@deleteOne");

        try {
            let result = await Scan.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error ScanModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('UsersResources@getAll');

        try {
            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (filterObj?.user_id) {
                dbQuery = {
                    ...dbQuery,
                    user_id: new ObjectId(filterObj.user_id)
                }
            }

            if (filterObj?.type) {
                dbQuery = {
                    ...dbQuery,
                    type: filterObj.type
                }
            }

            if (filterObj?.start_date && filterObj?.end_date) {
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: filterObj.start_date,
                        $lte: filterObj.end_date
                    }
                }
            }

            let attributes = filterObj?.attributes ? filterObj.attributes : "";

            let scans = await Scan.find(dbQuery)
                .select(attributes)
                .sort({ created_at: 1 })
                .lean();

            if (!scans) {
                results = [];
            }
            else {
                results = scans;
            }

            return results;

        } catch (error) {
            console.log("Error ScanModel@getAll: ", error);
            return [];
        }
    }

    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('ScanModel@getAllWithPagination');

        try {
            let resObj;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (filterObj?.type) {
                dbQuery = {
                    ...dbQuery,
                    type: filterObj.type
                };
            }

            if (filterObj?.user_id) {
                dbQuery = {
                    ...dbQuery,
                    user_id: new ObjectId(filterObj.user_id)
                };
            }

            let totalRecords = await Scan.countDocuments(dbQuery);

            let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            let scans = await Scan.aggregate([
                { $match: dbQuery }
            ])
                .sort({ created_at: -1 })
                .skip(pagination.offset)
                .limit(pagination.limit)

            if (!scans) {
                resObj = {
                    data: []
                };
            }
            else {
                resObj = {
                    data: scans,
                    pagination: {
                        total: totalRecords,
                        current_page: pagination.currentPage,
                        total_pages: pagination.totalPages,
                        per_page: pagination.limit
                    }
                };
            }

            return resObj;

        } catch (error) {
            console.log("Error ScanModel@getAllWithPagination: ", error);
            return false;
        }

    }

    getOneByBodyMetrics = async (userId, metrics) => {
        console.log('ScanModel@getOneByBodyMetrics');

        try {
            let dbQuery = {
                user_id: new ObjectId(userId),
                type: "body",
                "body_metrics.shoulder_tilt_raw": {
                    $gte: metrics.shoulder_tilt_raw - 1,
                    $lte: metrics.shoulder_tilt_raw + 1
                },
                "body_metrics.hip_tilt_raw": {
                    $gte: metrics.hip_tilt_raw - 1,
                    $lte: metrics.hip_tilt_raw + 1
                },
                "body_metrics.head_tilt_angle": {
                    $gte: metrics.head_tilt_angle - 1,
                    $lte: metrics.head_tilt_angle + 1
                },
                "body_metrics.shoulder_tilt_perc": {
                    $gte: metrics.shoulder_tilt_perc - 1,
                    $lte: metrics.shoulder_tilt_perc + 1
                },
                "body_metrics.hip_tilt_perc": {
                    $gte: metrics.hip_tilt_perc - 1,
                    $lte: metrics.hip_tilt_perc + 1
                },
                "body_metrics.arm_symmetry_perc": {
                    $gte: metrics.arm_symmetry_perc - 1,
                    $lte: metrics.arm_symmetry_perc + 1
                },
                created_at: {
                    $gte: moment().startOf('day').toDate(),
                    $lte: moment().endOf('day').toDate()
                },
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await Scan.findOne(dbQuery)
                .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error ScanModel@getOneByBodyMetrics: ", error);
            return false;
        }
    }

    getLastScan = async (columnName, columnValue, filterObj = {}) => {
        console.log('ScanModel@getLastScan');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: { $in: [null, '', ' '] } // not deleted
            };

            if (filterObj?.type) {
                dbQuery.type = filterObj.type;
            }

            let result = await Scan.findOne(dbQuery)
                .collation({ locale: 'en', strength: 2 })
                .sort({ created_at: -1 }); // latest first

            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error ScanModel@getLastScan: ", error);
            return false;
        }
    }

    getScanComparison = async (userId, params) => {
        console.log('ScanModel@getScanComparison');
        const { weight, weight_unit } = params;

        let result = {
            weight: {
                current: `${weight} ${weight_unit}`,
                change: `${weight} ${weight_unit}`,
                change_percent: `0%`
            },
            muscle_gain: {
                current: `0 ${weight_unit}`,
                change: `0 ${weight_unit}`,
                change_percent: `0%`
            },
            fat_loss: {
                current: `0%`,
                change: `0%`,
                change_percent: `0%`
            }
        }
        // console.log("Here ============= 1");

        // Conversion helpers
        const kgToLb = (kg) => +(kg * 2.20462).toFixed(1);
        const lbToKg = (lb) => +(lb / 2.20462).toFixed(1);

        try {

            // Get the latest two scans for this user (most recent first)
            const scans = await Scan.find({
                type: "body",
                user_id: userId,
                deleted_at: { $in: [null, '', ' '] }
            })
                .sort({ created_at: -1 })
                .limit(2);
            // console.log(JSON.stringify(scans), '==========scans');
            if (!scans?.length) {
                return result;
            }
            // console.log(JSON.stringify(scans), "======scans");
            // console.log(scans.length, "=========scans.length");
            if (scans.length < 2) {
                const scanObj = scans[0];

                const currentBodyFat = scanObj.body_report?.body_composition?.body_fat ?? 0;
                const leanBodyMass = Number(scanObj.weight) * (1 - (currentBodyFat / 100));

                result = {
                    weight: {
                        current: `${scanObj.weight} ${scanObj.weight_unit}`,
                        change: `${scanObj.weight} ${scanObj.weight_unit}`,
                        change_percent: `0%`
                    },
                    muscle_gain: {
                        current: `${leanBodyMass} ${scanObj.weight_unit}`,
                        change: `0 ${scanObj.weight_unit}`,
                        change_percent: `0%`
                    },
                    fat_loss: {
                        current: `${scanObj.body_report?.body_composition?.body_fat ?? 0}%`,
                        change: `0%`,
                        change_percent: `0%`
                    }
                }

                return result;
            }

            const [currentScan, previousScan] = scans;

            // console.log(currentScan, '==========currentScan');
            // console.log(previousScan, '==========previousScan');

            /// Extract weight and convert if necessary
            let currentWeight = currentScan.weight || 0;
            let prevWeight = previousScan.weight || 0;
            const storedUnit = currentScan.weight_unit || UserModel.weightUnits.KG; // assume stored unit

            if (storedUnit !== weight_unit) {
                if (weight_unit === UserModel.weightUnits.KG) {
                    currentWeight = lbToKg(currentWeight);
                    prevWeight = lbToKg(prevWeight);
                } else {
                    currentWeight = kgToLb(currentWeight);
                    prevWeight = kgToLb(prevWeight);
                }
            }

            // Extract body metrics (percentages)
            const currentLeanMass = currentScan.body_report?.muscle_development?.muscle_weight || 0;
            const prevLeanMass = previousScan.body_report?.muscle_development?.muscle_weight || 0;

            const currentBodyFat = currentScan.body_report?.body_composition?.body_fat || 0;
            const prevBodyFat = previousScan.body_report?.body_composition?.body_fat || 0;

            // console.log(prevWeight, currentWeight, "'=======currentWeight");

            // Weight comparison
            const weightDiff = currentWeight - prevWeight;
            const weightSign = weightDiff > 0 ? '+' : '';
            const weightPerc = prevWeight ? ((weightDiff / prevWeight) * 100).toFixed(1) : 0;

            // Muscle gain
            const muscleGain = currentLeanMass - prevLeanMass;
            const muscleSign = muscleGain > 0 ? '+' : '';
            const musclePerc = prevLeanMass ? ((muscleGain / prevLeanMass) * 100).toFixed(1) : 0;

            // Fat loss
            const fatLoss = prevBodyFat - currentBodyFat;
            const fatSign = fatLoss > 0 ? '-' : '+';
            const fatPerc = prevBodyFat ? ((fatLoss / prevBodyFat) * 100).toFixed(1) : 0;

            const leanBodyMass = currentWeight * (1 - (currentBodyFat / 100));

            // Return comparison object
            result = {
                weight: {
                    current: `${Number(currentWeight).toFixed(1)} ${weight_unit}`,
                    change: `${weightSign}${weightDiff.toFixed(1)} ${weight_unit}`,
                    change_percent: `${weightPerc}%`
                },
                muscle_gain: {
                    current: `${leanBodyMass} ${weight_unit}`,
                    change: `${muscleSign}${muscleGain.toFixed(1)} ${weight_unit}`,
                    change_percent: `${musclePerc}%`
                },
                fat_loss: {
                    current: `${currentBodyFat}%`,
                    change: `${fatSign}${Math.abs(fatLoss).toFixed(1)}%`,
                    change_percent: `${fatSign}${fatPerc}%`
                }
            };

            // console.log(result, '=========result');

            return result;

        } catch (error) {
            console.error("Error@getScanComparison:", error);
            return result;
        }
    };

    getProgressGraphData = async (filterObj = {}) => {
        console.log('UsersResources@getProgressGraphData');

        let results = {
            group_data: [],
            last_30_days_data: [],
            overall_data: []
        }

        try {

            let dbQuery = {
                type: 'body',
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (filterObj?.user_id) {
                dbQuery = {
                    ...dbQuery,
                    user_id: new ObjectId(filterObj.user_id)
                }
            }

            const overAllData = await Scan.find(dbQuery)
                .select('created_at weight body_report')
                .sort({ created_at: 1 })   // oldest → newest
                .lean();
            if (overAllData?.length) {
                results.overall_data = overAllData;
            }

            if (filterObj?.start_date && filterObj?.end_date) {
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: filterObj.start_date,
                        $lte: filterObj.end_date
                    }
                }
            }

            const last30DaysData = await Scan.find(dbQuery)
                .select('created_at weight body_report')
                .sort({ created_at: 1 })   // oldest → newest
                .lean();
            if (last30DaysData?.length) {
                results.last_30_days_data = last30DaysData;
            }

            const pipeline = [
                { $match: dbQuery },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
                        },
                        average_weight: { $avg: "$weight" },
                        average_body_fat: {
                            $avg: "$body_report.body_composition.body_fat"
                        },
                        average_muscle_weight: {
                            $avg: "$body_report.muscle_development.muscle_weight"
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]

            let groupedData = await Scan.aggregate(pipeline);
            if (groupedData?.length) {
                results.group_data = await groupedData.map(item => ({
                    date: item._id,
                    average_weight: item.average_weight,
                    average_body_fat: item.average_body_fat,
                    average_muscle_weight: item.average_muscle_weight,
                    count: item.count
                }));
            }


            return results;

        } catch (error) {
            console.log("Error ScanModel@getAll: ", error);
            return results;
        }
    }


    deleteFoodScanItem = async (scanData = {}) => {
        console.log('ScanController@deleteFoodScanItem');
        try {

            const { scan_id, food_id, user_id } = scanData;

            if (!scan_id || !food_id) {
                throw new Error('scan_id and food_id are required');
            }

            const result = await Scan.updateOne(
                {
                    _id: scan_id,
                    user_id: user_id,
                },
                {
                    $pull: {
                        foods: { _id: food_id }
                    }
                }
            );

            return result.modifiedCount > 0;

        } catch (error) {
            console.log("Error ScanModel@deleteFoodScanItem: ", error);
            return false;
        }
    };

    countScansThisWeek = async (userId, type, timezone = 'UTC') => {
        console.log('ScanModel@countScansThisWeek',  userId, type, timezone);

        try {
            
            const { startOfWeek, endOfWeek } = await dataHelper.getStartDateTimes(timezone);

            const count = await Scan.countDocuments({
                user_id: new ObjectId(userId),
                type: type,
                created_at: { $gte: startOfWeek, $lte: endOfWeek },
                deleted_at: { $in: [null, '', ' '] }
            });

            return count;

        } catch (error) {
            console.log("Error ScanModel@countScansThisWeek: ", error);
            return 0;
        }
    }
}

module.exports = new ScanModel;
