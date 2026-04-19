const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { parse: csvParser } = require("csv-parse/sync");
const moment = require('moment-timezone')

class DataHelper {

    /* Valiate the request body as per the provided schema */
    joiValidation = async (reqBody, schema, language = 'en') => {
        console.log('DataHelper@joiValidation');

        try {
            if (Joi.isSchema(schema)) {
                await schema.validateAsync(reqBody);
            }
            else {
                await Joi.object(schema).validateAsync(reqBody)
            }
            return false;
        }
        catch (errors) {
            let parsedErrors = [];

            if (errors.details) {
                errors = errors.details
                for (let e of errors) {
                    let msg = e.message.replace(/"/g, '');
                    parsedErrors.push(msg)
                }
            }

            if (parsedErrors.length > 0) {
                return parsedErrors;
            }
            else {
                return false;
            }
        }
    }

    /* Check the password strength */
    checkPasswordRegex = async (password) => {
        console.log('DataHelper@passwordRegex');

        let passwordRegex = RegExp('^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*[@$!%*?&]).{8,}');
        if (!passwordRegex.test(password)) {
            return false
        }
        return true;
    }

    /* Convert password string into hash */
    hashPassword = async (password) => {
        console.log('DataHelper@hashPassword');

        let hashedPassword = await bcrypt.hash(password, 10);
        if (!hashedPassword) {
            throw new Error('Error generating password hash');
        }

        return hashedPassword;
    }

    /* Validate the hashed password and the password string */
    validatePassword = async (passwordString, passwordHash) => {
        console.log("DataHelper@validatePassword");

        let isPasswordValid = await bcrypt.compare(passwordString, passwordHash)
        if (!isPasswordValid) {
            return false
        }

        return true
    }

    /* Generate the JWT token */
    generateJWTToken = async (data) => {
        console.log("DataHelper@generateJWTToken");

        let token = jwt.sign(data, process.env.JWT_TOKEN_KEY);
        if (!token) {
            return false;
        }

        return token;
    }

    /* Generate OTP */
    generateSecureOTP = async (length = 6) => {
        console.log('DataHelper@generateSecureOTP');

        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[crypto.randomInt(0, digits.length)];
        }
        return otp;
    }

    /** Validate the email */
    isValidEmail = async (value) => {
        // Regular expression for validating an email address
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(value)) {
            return true;
        } else {
            return false;
        }
    }

    /** Extract the page and limit from query params */
    getPageAndLimit = async (reqQuery) => {
        console.log('DataHelper@getPageAndLimit');

        let resObj = {
            page: 1,
            limit: 50,
        };

        if (reqQuery.page) {
            let pageNo = parseInt(reqQuery.page);

            if (typeof (pageNo) !== 'number') {
                pageNo = 1;
            }
            else if (pageNo < 1) {
                pageNo = 1;
            }

            resObj.page = pageNo;
        }

        if (reqQuery.limit) {
            let limit = parseInt(reqQuery.limit);

            if (typeof (limit) !== 'number') {
                limit = 50;
            }
            else if (limit < 1) {
                limit = 50;
            }

            if (limit > 100) {
                limit = 100;
            }

            resObj.limit = limit;
        }

        return resObj;
    }

    /** Calculate the pagination param and return the offest */
    calculatePagination = async (totalItems = null, currentPage = null, limit = null) => {
        console.log('DataHelper@calculatePagination');

        // set a default currentPage if it's not provided
        if (!currentPage) {
            currentPage = 1;
        }

        // set a default limit if it's not provided
        if (!limit) {
            if (totalItems > 50) {
                limit = 50
            } else {
                limit = totalItems;
            }
        }

        let totalPages = Math.ceil(totalItems / limit);
        if (totalPages < 1) {
            totalPages = 1;
        }

        // if the page number requested is greater than the total pages, set page number to total pages
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        let offset;
        if (currentPage > 1) {
            offset = (currentPage - 1) * limit;
        } else {
            offset = 0;
        }

        return {
            currentPage,
            totalPages,
            offset,
            limit
        }
    }

    /** Validate the mongoDB id */
    isValidMongoDBId = (id) => {
        console.log('DataHelper@isValidMongoDBId');
        if (!id || id == '') {
            return false;
        }
        return id.match(/^[0-9a-fA-F]{24}$/);
    }

    /** Generate random password for social login */
    generateRandomPassword = async (length = 12) => {
        return crypto.randomBytes(length)
            .toString('base64')         // base64 gives more complexity
            .replace(/[^a-zA-Z0-9]/g, '') // remove special chars
            .slice(0, length);           // ensure desired length
    };

    isValidJSON = async (str) => {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Calculate macros based on user data and goal defaults. */
    calculateMacros(userParams, nutrition) {

        // const user = {
        //     sex: 'male',
        //     age: 30,
        //     height: 180,    // cm
        //     weight: 75,     // kg
        //     activityLevel: 'moderate'
        // };

        // const goal = {
        //     title: 'Burn Fat',
        //     default_nutrition: {
        //         calorie_modifier: -0.2,
        //         protein_per_lb: 1.2,
        //         carbs_percent: 35,
        //         fat_percent: 30
        //     }
        // };

        const { age, gender, heightInCm, weightInKg, activityLevel = "moderate" } = userParams;

        const {
            calorie_modifier,
            protein_per_lb,
            carbs_percent,
            fat_percent
        } = nutrition;

        // Convert weight from kg to lb
        const weightLb = weightInKg * 2.20462;

        // 1. Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
        let bmr;
        if (gender === 'Male') {
            bmr = 10 * weightInKg + 6.25 * heightInCm - 5 * age + 5;
        } else {
            bmr = 10 * weightInKg + 6.25 * heightInCm - 5 * age - 161;
        }

        // 2. Apply activity multiplier
        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9
        };

        const activityFactor = activityMultipliers[activityLevel] || 1.2;
        const maintenanceCalories = bmr * activityFactor;

        // 3. Apply goal's calorie modifier (e.g., -0.2 for fat loss)
        const targetCalories = maintenanceCalories * (1 + calorie_modifier);

        // 4. Calculate macros in grams
        const proteinGrams = protein_per_lb * weightLb;
        const fatGrams = (targetCalories * (fat_percent / 100)) / 9;
        const carbsGrams = (targetCalories * (carbs_percent / 100)) / 4;

        // Round results for readability
        return {
            // maintenanceCalories: Math.round(maintenanceCalories),
            target_calories: Math.round(targetCalories),
            protein_grams: Math.round(proteinGrams),
            fat_grams: Math.round(fatGrams),
            carbs_grams: Math.round(carbsGrams)
        };
    }

    splitCleanLines(text) {
        if (!text) return [];
        return text
            .split("\n")
            .map(t => t.replace(/^\s*\d+\.\s*/, "").trim())
            .filter(Boolean);
    }

    splitOutsideParentheses(input) {
        if (!input)
            return [];

        // normalize multiple spaces and line breaks
        const s = input.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

        // split on comma which is not followed by a sequence of characters without '(' closing to ')'
        const parts = s.split(/,(?![^()]*\))/);

        // Trim each and fix stray unmatched parentheses
        return parts.map(p => {
            let t = p.trim();

            // If there is a leading or trailing stray parenthesis whitespace issue, normalize spacing
            t = t.replace(/\s*\(\s*/g, " (").replace(/\s*\)\s*/g, ")");
            return t;
        }).filter(Boolean);
    }

    /**
     * Convert uploaded Excel or CSV file to JSON
     */
    fileToJson = async (file) => {
        if (!file)
            throw new Error("File is required");

        const ext = path.extname(file.originalname).toLowerCase();
        let jsonData;

        try {
            if (ext === ".csv") {
                const content = fs.readFileSync(file.path, "utf-8");

                // Parse CSV
                jsonData = csvParser(content, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    skip_records_with_empty_values: true
                });

                // Post-process to ensure only valid rows
                if (Array.isArray(jsonData)) {
                    jsonData = jsonData.filter(row => {
                        // Check if row has any properties
                        if (!row || typeof row !== 'object' || Object.keys(row).length === 0) {
                            return false;
                        }

                        // Check if any cell has meaningful data
                        const hasData = Object.values(row).some(cell => {
                            return cell !== null &&
                                cell !== undefined &&
                                cell.toString().trim().length > 0;
                        });

                        return hasData;
                    });
                } else {
                    jsonData = [];
                }

                return jsonData;
            }
            else {
                // ... existing Excel code with similar filtering ...
                const workbook = xlsx.readFile(file.path);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                if (!rawData.length) return [];

                const headers = rawData[0].map(h => h.toString().trim());

                // Filter Excel rows similarly
                const jsonData = rawData.slice(1)
                    .filter(row => row.some(cell =>
                        cell !== null && cell !== undefined && cell.toString().trim() !== ""
                    ))
                    .map(row => {
                        const obj = {};
                        headers.forEach((h, idx) => {
                            obj[h] = row[idx] !== undefined && row[idx] !== null ? row[idx].toString().trim() : "";
                        });
                        return obj;
                    });

                return jsonData;
            }
        } catch (error) {
            throw new Error(`Failed to parse file: ${error.message}`);
        }
    };

    getExerciseLimitByDuration = (time) => {
        const t = Number(time);
        if (isNaN(t)) return { total: 0, pattern: [] };

        if (t <= 15) return {
            total: 3,
            pattern: ['C', 'C', 'I']
        };

        if (t <= 30) return {
            total: 4,
            pattern: ['C', 'C', 'I', 'I']
        };

        if (t <= 45) return {
            total: 6,
            pattern: ['C', 'C', 'I', 'I', 'I', 'I']
        };

        if (t <= 60) return {
            total: 7,
            pattern: ['C', 'C', 'C', 'I', 'I', 'I', 'I']
        };
        // > 60 mins
        const total = 10;
        const pattern = ['C', 'C', 'C', 'I', 'I', 'I', 'I', 'I', 'I', 'I'];

        return { total, pattern };
    };

    calculateMuscleDistribution = (selectedMuscles, totalExercises) => {
        console.log("datahelper@calculateMuscleDistribution")
        const muscleCount = selectedMuscles.length;
        const distributionRules = {
            3: { 1: [3], 2: [2, 1], 3: [1, 1, 1], 4: [1, 1, 1, 0], 5: [1, 1, 1, 0, 0] },
            4: { 1: [4], 2: [2, 2], 3: [2, 1, 1], 4: [1, 1, 1, 1], 5: [1, 1, 1, 1, 0] },
            6: { 1: [6], 2: [3, 3], 3: [3, 2, 1], 4: [2, 1, 1, 1], 5: [2, 1, 1, 1, 1] },
            7: { 1: [7], 2: [4, 3], 3: [3, 2, 2], 4: [2, 2, 2, 1], 5: [2, 2, 1, 1, 1] },
            10: { 1: [10], 2: [5, 5], 3: [4, 3, 3], 4: [3, 3, 2, 2], 5: [2, 2, 2, 2, 2] }
        };

        const rule = distributionRules[totalExercises];
        if (!rule) {
            const base = Math.floor(totalExercises / muscleCount);
            const remainder = totalExercises % muscleCount;
            const distribution = Array(muscleCount).fill(base);
            for (let i = 0; i < remainder; i++) distribution[i] += 1;
            return distribution;
        }

        let distribution = rule[Math.min(muscleCount, 5)] || [];

        // ensure no infinite loop; fill remaining slots safely
        if (distribution.length < muscleCount) {
            const zerosToAdd = muscleCount - distribution.length;
            distribution = distribution.concat(Array(zerosToAdd).fill(0));
        }
        return distribution.slice(0, muscleCount);
    };

    generateReferralCode = (length = 10) => {
        // Exclude 0, O, I, and 1 to prevent user confusion
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = "";

        // Generate random bytes
        const randomBytes = crypto.randomBytes(length);

        for (let i = 0; i < length; i++) {
            // Map each byte to our character set
            code += chars.charAt(randomBytes[i] % chars.length);
        }

        return code;
    };

    getPatternForCount = (count) => {
        if (count <= 0) return [];

        if (count === 1) return ['C'];
        if (count === 2) return ['C', 'I'];

        const patterns = {
            3: ['C', 'C', 'I'],
            4: ['C', 'C', 'I', 'I'],
            6: ['C', 'C', 'I', 'I', 'I', 'I'],
            7: ['C', 'C', 'C', 'I', 'I', 'I', 'I'],
            10: ['C', 'C', 'C', 'I', 'I', 'I', 'I', 'I', 'I', 'I']
        };

        // exact match
        if (patterns[count]) {
            return patterns[count];
        }

        // fallback to nearest lower pattern
        const keys = Object.keys(patterns)
            .map(Number)
            .sort((a, b) => b - a);

        const nearest = keys.find(k => k <= count);

        if (!nearest) {
            // below 3 (but we already handled 1 and 2)
            return Array(count).fill('C');
        }

        // pad with isolations if needed
        const base = [...patterns[nearest]];
        for (let i = base.length; i < count; i++) {
            base.push('I');
        }

        return base.slice(0, count);
    };

    /** * Helper to get TDEE 
     * activityMultiplier: 1.2 (Sedentary) to 1.9 (Very Active)
     */
    // calculateTDEE = (user) => {

    //     const UserModel = require('../../resources/v1/users/users.model');

    //     const { weight, weight_unit, height, height_unit, age, gender, workout_settings } = user;
    //     const activity_level = workout_settings?.experience_level;

    //     // Normalize to Metric for the formula
    //     const weightKg = weight_unit?.toLowerCase() === UserModel.weightUnits.LB ? weight / 2.20462 : weight;
    //     const heightCm = height_unit?.toLowerCase() === UserModel.heightUnits.INCH
    //         ? height * 2.54
    //         : height_unit?.toLowerCase() === UserModel.heightUnits.FT
    //             ? height * 30.48
    //             : height;

    //     // Calculate BMR
    //     const genderOffset = gender?.toLowerCase() === UserModel.genders.MALE ? 5 : -161;
    //     const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + genderOffset;

    //     // Activity Multipliers
    //     const multipliers = {
    //         [UserModel.experienceLevels.BEGINNER]: 1.2,
    //         [UserModel.experienceLevels.INTERMEDIATE]: 1.375,
    //         [UserModel.experienceLevels.ADVANCED]: 1.55,
    //         // [UserModel.experienceLevels.ELITE]: 1.725
    //     };

    //     const multiplier = multipliers[activity_level] || 1.2;
    //     return bmr * multiplier;
    // };

    /**
     * Get start date of the week, today or a specific day
     */
    getStartDateTimes = async (timezone = "UTC") => {

        const isTestMode = process.env.STREAK_MILESTONE_TEST_MODE === "true";
        const now = moment().tz(timezone);

        // 1. Determine the "Day" length for testing
        const dayUnit = isTestMode ? 'minute' : 'day';

        // For testing: 1 day = 5 minutes
        // To revert to daily: const slotSizeInMinutes = 1440;
        const slotSizeInMinutes = isTestMode ? 2 : 1440;
        const slotSizeMs = slotSizeInMinutes * 60 * 1000;

        // 2. Calculate Start of Day (The "Slot")
        // If testing, we snap to the nearest 5-minute block (0, 5, 10, etc.)
        let startOfDayObj;
        if (isTestMode) {
            const remainder = now.minutes() % slotSizeInMinutes;
            startOfDayObj = now.clone().subtract(remainder, 'minutes').startOf('minute');
        } else {
            startOfDayObj = now.clone().startOf('day');
        }
        const startOfDay = startOfDayObj.toDate();

        // 3. Calculate End of Day (End of the Slot)
        const endOfDayObj = isTestMode
                            ? startOfDayObj.clone().add(slotSizeInMinutes, 'minutes').subtract(1, 'second')
                            : now.clone().endOf('day');
        const endOfDay = endOfDayObj.toDate();

        // 4. Calculate Week Logic (Assuming a "Week" is 7 "Slots")
        const weekSizeInMinutes = slotSizeInMinutes * 7;

        let startOfWeekObj;
        if (isTestMode) {
            // Snap the week to a 35-minute boundary (7 slots * 5 mins)
            const weekRemainder = (now.hours() * 60 + now.minutes()) % weekSizeInMinutes;
            startOfWeekObj = now.clone().subtract(weekRemainder, 'minutes').startOf('minute');
        } else {
            startOfWeekObj = now.clone().startOf('isoWeek');
        }
        const startOfWeek = startOfWeekObj.toDate();

        const endOfWeekObj = isTestMode
                            ? startOfWeekObj.clone().add(weekSizeInMinutes, 'minutes').subtract(1, 'second')
                            : now.clone().endOf('isoWeek');
        const endOfWeek = endOfWeekObj.toDate();

        const dateTimeObj = {
            isTestMode,
            startOfWeek,
            endOfWeek,
            startOfWeekObj,
            endOfWeekObj,
            dayUnit,
            slotSizeInMinutes,
            slotSizeMs,
            startOfDay,
            endOfDay,
            startOfDayObj,
            endOfDayObj
        };
        // console.log("==========dateTimeObj", dateTimeObj);

        return dateTimeObj;
    };
}

module.exports = new DataHelper;
