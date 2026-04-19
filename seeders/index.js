/**
 * Seeder Runner
 * Executes all seeder scripts in series or parallel
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Seeder configuration
 */
const SEEDER_CONFIG = {
  files: ['admin.js'],
  timeout: 30000, // 30 seconds timeout per script
};

/**
 * Execute a single seeder script
 */
const executeSeeder = async (filename) => {
  try {
    const { stdout, stderr } = await execAsync(
      `node seeders/${filename}`,
      { timeout: SEEDER_CONFIG.timeout },
    );

    return {
      filename,
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    return {
      filename,
      success: false,
      error: error.message,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
    };
  }
};

/**
 * Log seeder result
 */
const logSeederResult = (result) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Seeder: ${result.filename}`);
  console.log(`${'='.repeat(60)}`);

  if (result.success) {
    console.log('✅ Status: Success');
    if (result.stdout) {
      console.log('\nOutput:');
      console.log(result.stdout);
    }
  } else {
    console.log('❌ Status: Failed');
    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }
    if (result.stderr) {
      console.log('\nError Output:');
      console.log(result.stderr);
    }
  }
};

/**
 * Run seeders in series (one after another)
 */
const runSeedersInSeries = async (files) => {
  console.log('🔄 Running seeders in series...\n');

  const results = await files.reduce(async (promiseChain, file) => {
    const accumulator = await promiseChain;
    console.log(`⏳ Executing: ${file}...`);
    const result = await executeSeeder(file);
    logSeederResult(result);
    return [...accumulator, result];
  }, Promise.resolve([]));

  return results;
};

/**
 * Run seeders in parallel (all at once)
 */
const runSeedersInParallel = async (files) => {
  console.log('⚡ Running seeders in parallel...\n');

  const promises = files.map((file) => {
    console.log(`⏳ Starting: ${file}...`);
    return executeSeeder(file);
  });

  const results = await Promise.all(promises);

  results.forEach(logSeederResult);

  return results;
};

/**
 * Print final summary
 */
const printSummary = (results, mode) => {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SEEDING SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Mode: ${mode}`);
  console.log(`Total Seeders: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed === 0) {
    console.log('🎉 All seeders completed successfully!\n');
  } else {
    console.log('⚠️  Some seeders failed. Please check the logs above.\n');
  }
};

/**
 * Parse command line arguments
 */
const parseOptions = () => {
  const args = process.argv.slice(2);
  return {
    parallel: args.includes('--parallel'),
  };
};

/**
 * Main seeder runner function
 */
const runSeeders = async () => {
  try {
    const options = parseOptions();
    const { files } = SEEDER_CONFIG;

    console.log('🌱 Starting database seeding...\n');

    // Run seeders based on mode
    const results = options.parallel
      ? await runSeedersInParallel(files)
      : await runSeedersInSeries(files);

    // Print summary
    const mode = options.parallel ? 'Parallel' : 'Series';
    printSummary(results, mode);

    // Exit with appropriate code
    const hasFailures = results.some((r) => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  runSeeders();
}

/**
 * Export for testing
 */
module.exports = {
  runSeeders,
};
