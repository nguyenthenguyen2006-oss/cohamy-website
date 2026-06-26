/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "cohamy",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};