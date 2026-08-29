// PM2 Ecosystem Configuration - Shopdemo
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "shopdemo",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/shopdemo",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/shopdemo/error.log",
      out_file: "/var/log/shopdemo/out.log",
      log_file: "/var/log/shopdemo/combined.log",
      time: true,
    },
  ],
};
