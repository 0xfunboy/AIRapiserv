import 'dotenv/config';
import { IngestionOrchestrator } from './services/ingestionOrchestrator.js';

const orchestrator = new IngestionOrchestrator();

async function main() {
  await orchestrator.start();
  process.on('SIGINT', async () => {
    await orchestrator.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
