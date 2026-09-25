module.exports = {
  apps: [
    {
      name: 'exiliados-backend',
      cwd: __dirname + '/backend',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: ['src/server.ts'],
      autorestart: true,
      watch: false,
    },
    {
      name: 'exiliados-frontend',
      cwd: __dirname + '/fronted',
      script: 'node_modules/next/dist/bin/next',
      args: ['dev'],
      autorestart: true,
      watch: false,
    },
  ],
}
