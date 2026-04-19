/**
 * Multi-IP Rate Limiter Test Utility
 * Tests rate limiting with multiple simulated IP addresses
 */

const http = require('http');

/**
 * Default test configuration
 */
const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:8000',
  endpoint: '/load-test',
  userCount: 10,
  requestsPerUser: 25,
  batchDelay: 50,
  batchSize: 50,
  timeout: 3000,
};

/**
 * IP address ranges for simulation
 */
const IP_RANGES = [
  '192.168',
  '10.0',
  '172.16',
];

/**
 * Generate fake IP address
 */
const generateFakeIP = (userId) => {
  const rangeIndex = userId % IP_RANGES.length;
  const range = IP_RANGES[rangeIndex];
  const thirdOctet = Math.floor(userId / 255) + 1;
  const fourthOctet = (userId % 254) + 1;

  return `${range}.${thirdOctet}.${fourthOctet}`;
};

/**
 * Create empty statistics object
 */
const createEmptyStats = () => ({
  successful: 0,
  blocked: 0,
  errors: 0,
  total: 0,
  byIP: new Map(),
});

/**
 * Create empty IP statistics
 */
const createEmptyIPStats = () => ({
  successful: 0,
  blocked: 0,
  errors: 0,
});

/**
 * Update statistics with result
 */
const updateStats = (stats, result) => {
  const { ip, statusCode } = result;

  // Create new stats object
  const newStats = {
    ...stats,
    total: stats.total + 1,
    byIP: new Map(stats.byIP),
  };

  // Ensure IP stats exist
  if (!newStats.byIP.has(ip)) {
    newStats.byIP.set(ip, createEmptyIPStats());
  }

  // Get IP stats and create updated version
  const ipStats = newStats.byIP.get(ip);
  const updatedIPStats = { ...ipStats };

  // Update based on status code
  if (statusCode === 200) {
    newStats.successful = stats.successful + 1;
    updatedIPStats.successful += 1;
  } else if (statusCode === 429) {
    newStats.blocked = stats.blocked + 1;
    updatedIPStats.blocked += 1;
  } else {
    newStats.errors = stats.errors + 1;
    updatedIPStats.errors += 1;
  }

  newStats.byIP.set(ip, updatedIPStats);

  return newStats;
};

/**
 * Parse URL components
 */
const parseUrl = (baseUrl, endpoint) => {
  const url = new URL(endpoint, baseUrl);
  return {
    hostname: url.hostname,
    port: url.port || 8000,
    path: url.pathname,
  };
};

/**
 * Make HTTP request with custom IP headers
 */
const makeRequestWithIP = (baseUrl, endpoint, ip, timeout) => new Promise((resolve) => {
  const urlComponents = parseUrl(baseUrl, endpoint);

  const options = {
    ...urlComponents,
    method: 'GET',
    timeout,
    headers: {
      'X-Forwarded-For': ip,
      'X-Real-IP': ip,
    },
  };

  const startTime = Date.now();
  const req = http.request(options, (res) => {
    // Consume response data
    res.resume();

    res.on('end', () => {
      resolve({
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        ip,
        success: res.statusCode === 200,
      });
    });
  });

  req.on('error', (error) => {
    resolve({
      statusCode: 0,
      duration: Date.now() - startTime,
      ip,
      error: error.message,
      success: false,
    });
  });

  req.on('timeout', () => {
    req.destroy();
    resolve({
      statusCode: 0,
      duration: Date.now() - startTime,
      ip,
      error: 'Timeout',
      success: false,
    });
  });

  req.end();
});

/**
 * Create progress tracker
 */
const createProgressTracker = (total) => {
  let completed = 0;
  let interval = null;

  return {
    start: () => {
      interval = setInterval(() => {
        const percent = ((completed / total) * 100).toFixed(1);
        process.stdout.write(`\r📨 Progress: ${completed}/${total} (${percent}%)`);
      }, 100);
    },
    increment: () => {
      completed += 1;
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        console.log(`\r📨 Progress: ${completed}/${total} (100.0%)`);
      }
    },
  };
};

/**
 * Execute multi-user test
 */
const runMultiUserTest = async (config) => {
  console.log(`🧪 Testing ${config.userCount} users with ${config.requestsPerUser} requests each\n`);

  let stats = createEmptyStats();
  const totalRequests = config.userCount * config.requestsPerUser;
  const progress = createProgressTracker(totalRequests);
  const allPromises = [];

  progress.start();

  for (let userId = 1; userId <= config.userCount; userId += 1) {
    const userIP = generateFakeIP(userId);

    for (let requestNum = 1; requestNum <= config.requestsPerUser; requestNum += 1) {
      const promise = makeRequestWithIP(
        config.baseUrl,
        config.endpoint,
        userIP,
        config.timeout,
      ).then((result) => {
        progress.increment();
        return result;
      });

      allPromises.push(promise);

      // Add delay between batches
      if (allPromises.length % config.batchSize === 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, config.batchDelay);
        });
      }
    }
  }

  const results = await Promise.all(allPromises);
  progress.stop();

  // Update stats with all results
  stats = results.reduce((acc, result) => updateStats(acc, result), stats);

  return stats;
};

/**
 * Print test report
 */
const printTestReport = (stats) => {
  console.log('\n\n📈 ===== MULTI-IP TEST RESULTS =====');
  console.log(`👥 Users Simulated: ${stats.byIP.size}`);
  console.log(`📨 Total Requests: ${stats.total}`);
  console.log(`✅ Successful: ${stats.successful}`);
  console.log(`🚫 Rate Limited: ${stats.blocked}`);
  console.log(`❌ Errors: ${stats.errors}`);

  console.log('\n📊 Per-IP Breakdown:');
  stats.byIP.forEach((ipStats, ip) => {
    console.log(`   ${ip}: ✅ ${ipStats.successful} 🚫 ${ipStats.blocked} ❌ ${ipStats.errors}`);
  });

  // Validate rate limiter effectiveness
  let allIPsLimited = true;
  const maxAllowedPerIP = 200; // Expected rate limit

  stats.byIP.forEach((ipStats, ip) => {
    if (ipStats.successful > maxAllowedPerIP) {
      console.log(`⚠️  IP ${ip} may not be properly limited (${ipStats.successful} successes)`);
      allIPsLimited = false;
    }
  });

  if (allIPsLimited) {
    console.log('\n🎉 Rate limiter is correctly limiting per IP!');
  } else {
    console.log('\n⚠️  Rate limiter may not be working as expected');
  }
};

/**
 * Parse command line arguments
 */
const parseArguments = () => {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  const baseUrlIndex = args.indexOf('--base-url');
  if (baseUrlIndex !== -1 && args[baseUrlIndex + 1]) {
    config.baseUrl = args[baseUrlIndex + 1];
  }

  const usersIndex = args.indexOf('--users');
  if (usersIndex !== -1 && args[usersIndex + 1]) {
    config.userCount = parseInt(args[usersIndex + 1], 10);
  }

  const requestsIndex = args.indexOf('--requests');
  if (requestsIndex !== -1 && args[requestsIndex + 1]) {
    config.requestsPerUser = parseInt(args[requestsIndex + 1], 10);
  }

  return config;
};

/**
 * Main test runner
 */
const runTest = async () => {
  try {
    const config = parseArguments();
    const stats = await runMultiUserTest(config);
    printTestReport(stats);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run test if executed directly
if (require.main === module) {
  runTest();
}

/**
 * Export for testing
 */
module.exports = {
  runMultiUserTest,
  makeRequestWithIP,
  generateFakeIP,
  createEmptyStats,
  updateStats,
  DEFAULT_CONFIG,
};
