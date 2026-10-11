import { networkInterfaces } from 'node:os';
import { readServerConfig } from './config';
import { startServer } from './server';

const config = readServerConfig();
const server = await startServer(config);

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => `ws://${net!.address}:${server.port}`);

console.log(`Mind Racer server escuchando en http://localhost:${server.port} (salud: /health)`);
for (const address of lanAddresses) console.log(`  red local: ${address}`);
console.log(
  config.allowedOrigins
    ? `  orígenes permitidos: ${config.allowedOrigins.join(', ')}`
    : '  orígenes permitidos: todos (sin ALLOWED_ORIGINS)',
);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
