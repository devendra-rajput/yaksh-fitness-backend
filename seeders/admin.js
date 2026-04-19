require('dotenv').config();

const mongoose = require('mongoose');

/** Custom Require **/ 
const User = require('../resources/v1/users/user.schema');
const dataHelper = require('../helpers/v1/data.helpers');

(async () => {
  try {
    /** Opend the DB connection */
    mongoose.connect(process.env.DATABASE_URL).then(() => {
      console.log("connection open !!");
    }).catch((err) => {
      console.error(err);
    });

    const hashedPassword = await dataHelper.hashPassword('Admin@123');
    const users = [{
      "email": "admin@yopmail.com",
      "password": hashedPassword,
      "user_info": {
        "first_name": "Super",
        "last_name": "Admin"
      },
      "phone_code": "+1",
      "phone_number": "1234567890",
      "tokens": {
        "auth_token": "",
        "fcm_token": "",
      },
      "role": "admin",
      "status": "1",
      "is_email_verified": true,
      "deleted_at": null
    }];

    /** Seed the database */
    const seedDB = async () => {
      await User.deleteMany({ role: 'admin' });
      await User.insertMany(users);
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
