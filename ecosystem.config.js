/**
 * PM2 ecosystem configuration to run and auto-restart both
 * server and client in production. PM2 will restart apps on crash
 * and provides a restart delay to avoid rapid crash loops.
 *
 * Usage:
 *  - Install pm2: `bun add -d pm2` (done by the setup script below)
 *  - Start: `pm2 start ecosystem.config.js --env production`
 *  - Stop: `pm2 stop ecosystem.config.js`
 */

module.exports = {
  apps: [
    {
      name: 'beuna-server',
      // Use bun to start the server via package.json script so env is applied
      script: 'bun',
      args: 'run --cwd server start',
      autorestart: true,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'beuna-client',
      // Serve built client via vite preview (or the static server you prefer)
      script: 'bun',
      args: 'run --cwd client preview',
      autorestart: true,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
