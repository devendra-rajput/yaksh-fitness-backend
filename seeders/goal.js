require('dotenv').config();

const mongoose = require('mongoose');

/** Custom Require **/ 
const Goal = require('../resources/v1/goals/goal.schema');

(async () => {
  try {
    /** Opend the DB connection */
    mongoose.connect(process.env.DATABASE_URL).then(() => {
      console.log("connection open !!");
    }).catch((err) => {
      console.error(err);
    });

    const goals = [
      {
        "title": "Burn Fat",
        "slug": "burn_fat",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": -0.2, // 20% below maintenance
          "protein_per_lb": 1.2,
          "carbs_percent": 35,
          "fat_percent": 30
        }
      },
      {
        "title": "Build Muscle",
        "slug": "build_muscle",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": 0.15, // 15% surplus
          "protein_per_lb": 1.2,
          "carbs_percent": 50,
          "fat_percent": 25
        }
      },
      {
        "title": "Get Toned",
        "slug": "get_toned",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": -0.1, // small deficit
          "protein_per_lb": 1.1,
          "carbs_percent": 35,
          "fat_percent": 30
        }
      },
      {
        "title": "Improve Mobility",
        "slug": "improve_mobility",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": 0.0, // maintenance
          "protein_per_lb": 0.9,
          "carbs_percent": 45,
          "fat_percent": 30
        }
      },
      {
        "title": "Fix Pain",
        "slug": "fix_pain",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": 0.0,
          "protein_per_lb": 1.0,
          "carbs_percent": 35,
          "fat_percent": 35
        }
      },
      {
        "title": "Eat Smarter",
        "slug": "eat_smarter",
        "is_default": true,
        "default_nutrition": {
          "calorie_modifier": 0.0,
          "protein_per_lb": 0.9,
          "carbs_percent": 45,
          "fat_percent": 30
        }
      }
    ];

    /** Seed the database */
    const seedDB = async () => {
      await Goal.deleteMany({ is_default: true });
      await Goal.insertMany(goals);
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
