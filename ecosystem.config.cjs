module.exports = {
  apps: [
    {
      name: 'beuna-server',
      cwd: __dirname,
      script: 'bun',
      args: 'run server:prod',
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 100,
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'beuna-client',
      cwd: __dirname,
      script: 'bun',
      args: 'run client:preview -- --host 0.0.0.0 --port 80',
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 100,
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
