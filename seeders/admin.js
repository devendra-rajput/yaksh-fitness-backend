/**
 * Admin User Seeder
 * Seeds the database with default admin user
 */

const minimist = require('minimist');
const mongoose = require('mongoose');
const { User } = require('../resources/v1/users/user.schema');
const dataHelper = require('../helpers/v1/data.helpers');

/**
 * Parse command line arguments
 */
const parseArguments = () => {
  const args = minimist(process.argv.slice(2));
  return {
    environment: args.env || 'development',
  };
};

/**
 * Load environment configuration
 */
const loadEnvironment = (environment) => {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: `.env.${environment}` });
  console.log(`✅ Loaded environment: ${environment}`);
};

/**
 * Connect to MongoDB database
 */
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 */
const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error.message);
  }
};

/**
 * Create admin user data
 */
const createAdminUserData = (hashedPassword) => ({
  email: 'admin@yopmail.com',
  password: hashedPassword,
  user_info: {
    first_name: 'Super',
    last_name: 'Admin',
  },
  phone_code: '+1',
  phone_number: '1234567890',
  tokens: {
    auth_token: '',
    fcm_token: '',
  },
  role: 'admin',
  status: '1',
  is_email_verified: true,
  deleted_at: null,
});

/**
 * Seed admin user
 */
const seedAdminUser = async () => {
  try {
    console.log('🌱 Starting admin user seeding...');

    // Hash password
    const hashedPassword = await dataHelper.hashPassword('Admin@123');

    // Create admin user data
    const adminUser = createAdminUserData(hashedPassword);

    // Delete existing admin users
    const deleteResult = await User.deleteMany({ role: 'admin' });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing admin user(s)`);

    // Insert new admin user
    const insertResult = await User.insertMany([adminUser]);
    console.log(`✅ Inserted ${insertResult.length} admin user(s)`);
    console.log(`📧 Admin email: ${adminUser.email}`);
    console.log('🔑 Admin password: Admin@123');
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    throw error;
  }
};

/**
 * Main seeder function
 */
const runSeeder = async () => {
  try {
    // Parse arguments and load environment
    const { environment } = parseArguments();
    loadEnvironment(environment);

    // Connect to database
    await connectDatabase();

    // Seed admin user
    await seedAdminUser();

    console.log('\n🎉 Admin seeding completed successfully!\n');

    // Disconnect from database
    await disconnectDatabase();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);

    // Ensure database connection is closed
    await disconnectDatabase();

    process.exit(1);
  }
};

// Run seeder if executed directly
if (require.main === module) {
  runSeeder();
}

/**
 * Export for testing
 */
module.exports = {
  runSeeder,
};
