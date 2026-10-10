import { networkInterfaces } from 'node:os';
import { startServer } from './server';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';

const server = await startServer({ port, host });

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => `ws://${net!.address}:${server.port}`);

console.log(`Mind Racer server escuchando en ws://localhost:${server.port}`);
for (const address of lanAddresses) console.log(`  red local: ${address}`);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
