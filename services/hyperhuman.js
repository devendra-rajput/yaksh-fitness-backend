const i18n = require('../config/v1/i18n');
const axios = require("axios");

const UserModel = require('../resources/v1/users/users.model');

class HyperhumanService {

    constructor() {
        // this.apiKey = process.env.HYPERHUMAN_API_KEY ?? "21fc131c-148b-4183-a58a-cc6d63621180";
        this.organizationId = process.env.HYPERHUMAN_ORGANIZATION_ID ?? "68b714dafdac150012193ef4";
        // this.baseUrl = process.env.HYPERHUMAN_API_URL ?? "https://content.api.hyperhuman.cc";

        this.axios = axios.create({
            baseURL: process.env.HYPERHUMAN_API_URL ?? "https://content.api.hyperhuman.cc", // Replace with your API base URL
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Api-Key': process.env.HYPERHUMAN_API_KEY ?? "21fc131c-148b-4183-a58a-cc6d63621180" // Replace with your actual API key
            }
        });
    }

    /** Get workouts to display on library page */
    getWorkoutsByOrganizationId = async (page, limit, filterObj) => {
        console.log("HyperhumanService@getWorkoutsByOrganizationId")

        const queryParams = new URLSearchParams({
            page: page,
            limit: limit,
            visibility: 'public',
            status: 'published'
        });

        if(filterObj?.category_ids){
            queryParams.append('categoryIds', filterObj.category_ids);
        }

        if(filterObj?.search){
            queryParams.append('q', filterObj.search);
        }
        
        if(filterObj?.difficulty){
            queryParams.append('difficulty', filterObj.difficulty);
        }

        if(filterObj?.duration){
            queryParams.append('duration', filterObj.duration);
        }

        console.log(queryParams, '==========queryParams');

        let url = `/v1/orgs/${this.organizationId}/workouts?${queryParams.toString()}`;
        
        try {

            const response = await this.axios.get(url)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                // console.log(error.response.data.error, "=========error");
                                                console.error('Errorrrr:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkouts")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            console.log(error, '=========error');
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkouts")
            }
        }
    };

    /** Get workout categories to display on library page */
    getWorkoutCategories = async () => {
        console.log("HyperhumanService@getWorkoutCategories")

        let url = `/v1/workouts/metadata`;
        
        try {

            const response = await this.axios.get(url)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                console.error('Error:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkoutCategories")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkoutCategories")
            }
        }
    };

    /** Get workout equipments to display on filters section */
    getWorkoutEquipments = async () => {
        console.log("HyperhumanService@getWorkoutEquipments")

        let url = `/v1/workouts/equipment/metadata`;
        
        try {

            const response = await this.axios.get(url)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                console.error('Error:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkoutEquipments")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkoutEquipments")
            }
        }
    };

    /** Get workout muscle groups to display on filters section */
    getWorkoutMuscleGroups = async () => {
        console.log("HyperhumanService@getWorkoutMuscleGroups")

        let url = `/v1/workouts/exercises/metadata`;
        
        try {

            const response = await this.axios.get(url)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                console.error('Error:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkoutMuscleGroups")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkoutMuscleGroups")
            }
        }
    };

    /** Get workouts for today */
    getWorkoutsForToday = async (workoutSettings) => {
        console.log("HyperhumanService@getWorkoutsForToday")

        let fitnessLevel;
        if(workoutSettings?.experience_level){
            if(workoutSettings.experience_level == UserModel.experienceLevels.BEGINNER){
                fitnessLevel = "beginner"
            }
            else if(workoutSettings.experience_level == UserModel.experienceLevels.INTERMEDIATE){
                fitnessLevel = "intermediate"
            }
            else if(workoutSettings.experience_level == UserModel.experienceLevels.ADVANCED){
                fitnessLevel = "advanced"
            }
        }

        let endUserProfileDetails = {
            ...(workoutSettings?.age && {age: workoutSettings.age}),
            ...(workoutSettings?.gender && {gender: workoutSettings.gender.toLowerCase()}),
            ...(fitnessLevel && {fitnessLevels: [fitnessLevel]}),
            ...(workoutSettings?.days_per_week && {trainingDaysPerWeek: workoutSettings.days_per_week})
        }

        const data = {
            endUserProfileDetails: endUserProfileDetails
            // "endUserProfileDetails": {
            //     "age": 30,
            //     "gender": "female",
            //     "fitnessLevels": [
            //         "intermediate"
            //     ],
            //     "goalIds": [
            //         "63c92926f920a9005c4e619c"
            //     ],
            //     "trainingDaysPerWeek": 3,
            //     "preferredEquipmentCategoryIds": [
            //         "67deb36a6a5e49797c122f56"
            //     ]
            // }
        };

        let url = `/v1/orgs/${this.organizationId}/workouts/recommend`;

        try {

            const response = await this.axios.post(url, data)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                // console.log(error.response.data.error, "=========error");
                                                console.error('Errorrrr:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkouts")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            console.log(error, '=========error');
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkouts")
            }
        }
    }

    /** Generate workouts for today */
    generateWorkouts = async (filterObj) => {
        console.log("HyperhumanService@generateWorkouts")

        let url = `/v1/orgs/${this.organizationId}/workouts/generate`;

        try {

            const response = await this.axios.post(url, filterObj)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                // console.log(error, '============error');
                                                console.log(error?.response?.data?.error, "=========error");
                                                return false
                                            });
            
            if(!response){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkouts")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            console.log(error, "======error");
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkouts")
            }
        }
    }

    /** Get workout details */
    getWorkoutDetail = async (workoutId) => {
        console.log("HyperhumanService@getWorkoutDetail")

        let url = `/v1/workouts/${workoutId}`;
        
        try {

            const response = await this.axios.get(url)
                                            .then(response => {
                                                // console.log(response.data);
                                                return response.data;
                                            })
                                            .catch(error => {
                                                console.error('Error:', error.response ? error.response.data : error.message);
                                                return false
                                            });
            
            if(!response?.data){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchWorkoutDetail")
                }
            }

            return {
                status: true,
                data: response.data
            }

        } catch (error) {
            console.log(error, '=========error');
            return {
                status: false,
                message: i18n.__("error.failedToFetchWorkoutDetail")
            }
        }
    };
}

module.exports = new HyperhumanService;