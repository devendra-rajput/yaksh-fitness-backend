// Import required Node.js modules
const { exec } = require('child_process'); // For executing shell commands
const { promisify } = require('util');     // To convert callback-based APIs to Promises

// Promisify the exec function to use with async/await
const execAsync = promisify(exec);

// List of script files to execute
const files = ['admin.js'];

/**
 * Run the scripts one after another in series.
 * Each script is executed only after the previous one completes.
 */
async function runScriptsInSeries() {
    try {
        for (const file of files) {
            // Execute each script using node and capture the output
            const { stdout, stderr } = await execAsync(`node seeders/${file}`);

            // If there's any error output, log it
            if (stderr) {
                console.error(`Error in ${file}:`, stderr);
            } else {
                // Otherwise, print the standard output
                console.log(`Output from ${file}:`, stdout);
            }
        }

        // All scripts have been run
        console.log('All scripts executed in series.');
    } catch (err) {
        // Catch and log any error that occurs during execution
        console.error('Execution failed:', err);
    }
}

/**
 * Run all scripts at the same time in parallel.
 * This is faster, but not suitable if scripts depend on each other.
 */
async function runScriptsInParallel() {
    try {
        // Map each file to a Promise returned by execAsync
        const results = await Promise.all(
            files.map(file => execAsync(`node seeders/${file}`))
        );

        // Loop through the results and print outputs or errors
        results.forEach(({ stdout, stderr }, index) => {
            const file = files[index];
            if (stderr) {
                console.error(`Error in ${file}:`, stderr);
            } else {
                console.log(`Output from ${file}:`, stdout);
            }
        });

        // All scripts have completed
        console.log('All scripts executed in parallel.');
    } catch (err) {
        // Catch and log errors from any failed script
        console.error('Execution failed:', err);
    }
}

// Choose one method to run your seed scripts:
// Uncomment one of the lines below based on whether you want serial or parallel execution

runScriptsInSeries();     // Run scripts one by one
// runScriptsInParallel();  // Run scripts simultaneously
