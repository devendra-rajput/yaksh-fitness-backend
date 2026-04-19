require('dotenv').config();

const mongoose = require('mongoose');

/** Custom Require **/ 
const Setting = require('../resources/v1/settings/setting.schema');

(async () => {
  try {

    /** Opend the DB connection */
    mongoose.connect(process.env.DATABASE_URL).then(() => {
      console.log("connection open !!");
    }).catch((err) => {
      console.error(err);
    });

    const settingData = {
      training_preferences: [
        "Bodyweight Only", 
        "Circuits / HIIT", 
        "Hypertrophy / Bodybuilding", 
        "Mobility / Stretching", 
        "Pilates", 
        "Strength Training", 
        "Yoga"
      ],
      diet_styles: [
        "Gluten Free", 
        "Ketogenic", 
        "Lacto-Vegetarian", 
        "Low FODMAP", 
        "Ovo-Vegetarian", 
        "Paleo", 
        "Pescetarian", 
        "Primal", 
        "Vegetarian", 
        "Vegan", 
        "Whole30"
      ],
      cuisines: [
        "African", "Asian", "American", "British", "Cajun", "Caribbean", "Chinese", "Eastern European",
        "European", "French", "German", "Greek", "Indian", "Irish", "Italian", "Japanese", "Jewish",
        "Korean", "Latin American", "Mediterranean", "Mexican", "Middle Eastern", "Nordic",
        "Southern", "Spanish", "Thai",  "Vietnamese"
      ],
      equipments: [
        "Bands", 
        "Barbell", 
        "Bench", 
        "Bodyweight", 
        "Cable", 
        "Dumbbells", 
        "Kettlebells", 
        "Machines", 
        "Mat", 
        "TRX"
      ],
      meal_types: [
        "appetizer", 
        "beverage", 
        "bread", 
        "breakfast", 
        "dessert", 
        "drink", 
        "fingerfood", 
        "main course", 
        "marinade", 
        "salad", 
        "sauce", 
        "side dish", 
        "snack", 
        "soup"
      ]
    };

    /** Seed the database */
    const seedDB = async () => {
      await Setting.deleteMany();
      await Setting.create(settingData);
    };

    /** After complete the seeding process clode the DB connection */
    seedDB().then(() => {
      mongoose.connection.close()
    })
  
  } catch (err) {
    console.error("Error seeding database:", err);
    mongoose.connection.close();
  }
})();
