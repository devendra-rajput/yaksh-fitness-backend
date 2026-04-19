module.exports = {
  apps: [{
    name: 'node-js-boilerplate', // Application name for PM2 process identification
    script: './index.js', // Entry point script file for the application

    // Cluster mode configurations
    instances: '-2', // Number of instances: "max" = All CPU cores, Positive number = Specific number of cores, Negative number = Total cores minus specified number
    exec_mode: 'cluster', // Execution mode: "cluster" = Load balancing across instances, "fork" = Single instance

    // Environment-specific configurations
    env_development: { // Development environment variables (use with --env development)
      NODE_ENV: 'development', // Environment identifier for development mode
    },
    env_production: { // Production environment variables (use with --env production)
      NODE_ENV: 'production', // Environment identifier for production mode
    },

    // Auto-restart & monitoring configurations
    autorestart: true, // Automatically restart app on crash: true = Enable, false = Disable
    watch: false, // File system watching: true = Restart on file changes, false = No watching
    max_memory_restart: '1G', // Restart if memory exceeds: '1G' = 1 Gigabyte, '500M' = 500 Megabytes

    // Restart strategies for application stability
    max_restarts: 10, // Maximum number of consecutive restart attempts before giving up
    min_uptime: '10s', // Minimum time application must run to be considered stable

    // Logging configurations
    error_file: './logs/err.log', // File path for error logs (stderr output)
    out_file: './logs/out.log', // File path for standard output logs (stdout output)
    log_file: './logs/combined.log', // File path for combined logs (both stdout and stderr)
    time: true, // Prepend timestamps to all log entries: true = Enable, false = Disable

    // Node.js runtime options
    node_args: '--max-old-space-size=1024', // Node.js arguments: Set maximum heap size to 1GB (1024MB)
  }],
};
