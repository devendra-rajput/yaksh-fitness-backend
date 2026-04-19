/** Custom Require **/
const response = require('../../../helpers/v1/response.helpers');
const UserStreakModel = require('./user_streaks.model');
const UserTokenModel = require('../user_tokens/user_tokens.model');

class UserStreakController {

    getStreak = async (req, res) => {
        console.log('UserStreakController@getStreak');

        const timezone = req.timezone || 'UTC';
        const userId = req.user._id;

        // Track app open
        await UserStreakModel.trackAppOpen(userId, timezone);

        const streakObj = await UserStreakModel.getOneByColumnNameAndValue({ user_id: userId });

        if (!streakObj) {
            // Return 0 if no record exists yet
            return response.success("success.streakFetched", res, {
                streak_count: 0,
                // milestone_count: 0,
                last_completed_date: null
            });
        }

        const formattedData = await UserStreakModel.getFormattedData(streakObj, timezone);

        return response.success("success.streakFetched", res, formattedData);
    }

    updateStreak = async (req, res) => {
        console.log('UserStreakController@updateStreak');

        const userId = req.user._id;
        const timezone = req.timezone || 'UTC';
        const { flag } = req.body;

        if (flag === 'scan_food') {
            await UserStreakModel.trackScanMilestones(userId, 'food', timezone);
            await UserTokenModel.addActivityTokens(userId, timezone, 'food_scan');
        }
        else if (flag === 'food_log') {
            await UserStreakModel.trackMealMilestones(userId, timezone);
        }
        else if (flag === 'voice_food_log') {
            await UserStreakModel.trackVoiceMilestones(userId, timezone);
            await UserTokenModel.addActivityTokens(userId, timezone, 'voice_log');
        }
        else if (flag === 'app_open') {
            await UserStreakModel.trackAppOpen(userId, timezone);
        }
        else if (flag === 'sixty_seconds_workout') {
            await UserStreakModel.trackSixtySecondsWorkout(userId, timezone);
        }

        if(flag != 'app_open'){
            const hasUpdated = await UserStreakModel.updateStreakCount(userId, timezone);
            if (!hasUpdated) {
                return response.exception("error.serverError", res, false);
            }
        }

        let streakObj = await UserStreakModel.getOneByColumnNameAndValue({ user_id: userId });
        if (!streakObj) {
            streakObj = {
                streak_count: 0,
                // milestone_count: 0,
                last_completed_date: null
            };
        }

        const formattedData = await UserStreakModel.getFormattedData(streakObj, timezone);

        return response.success("success.streakUpdated", res, formattedData);
    }
}

module.exports = new UserStreakController();
