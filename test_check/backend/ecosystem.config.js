module.exports = {
  apps: [
    {
      name: 'abs-staff-backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5180,
      },
    },
  ],
};
