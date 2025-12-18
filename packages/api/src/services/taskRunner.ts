import { TaskQueueRepository } from '@airapiserv/storage';
import { DiscoveryService } from './discoveryService.js';
import { VenueSyncService } from './venueSyncService.js';
import { CoverageService } from './coverageService.js';
import { TaskType } from './taskTypes.js';
import { IngestionService } from './ingestionService.js';
import { ReverifyService } from './reverifyService.js';
import { TokenResolverService } from './tokenResolverService.js';

const discovery = new DiscoveryService();
const venueSync = new VenueSyncService();
const coverage = new CoverageService();
const ingestion = new IngestionService();
const reverify = new ReverifyService();
const resolver = new TokenResolverService();
const queue = new TaskQueueRepository();

const MINUTES = 60 * 1000;

export async function runNextTask() {
  const task = await queue.fetchNext();
  if (!task) return null;
  try {
    switch (task.type as TaskType) {
      case 'DISCOVER_TOKENS_API':
        await discovery.run();
        await queue.enqueue({ type: 'DISCOVER_TOKENS_API', priority: task.priority, runAfter: new Date(Date.now() + 24 * MINUTES * 60) });
        break;
      case 'RESOLVE_TOKENS':
        await resolver.run();
        await queue.enqueue({ type: 'RESOLVE_TOKENS', priority: task.priority, runAfter: new Date(Date.now() + 12 * MINUTES * 60) });
        break;
      case 'SYNC_VENUE_MARKETS':
        await venueSync.run();
        await queue.enqueue({ type: 'SYNC_VENUE_MARKETS', priority: task.priority, runAfter: new Date(Date.now() + 60 * MINUTES) });
        break;
      case 'RESOLVE_TOKEN_VENUES':
        await coverage.run();
        await queue.enqueue({ type: 'RESOLVE_TOKEN_VENUES', priority: task.priority, runAfter: new Date(Date.now() + 30 * MINUTES) });
        break;
      case 'INGEST_OHLCV_API':
        await ingestion.ingestOhlcvApi((task.payload as any) ?? {});
        break;
      case 'INGEST_OHLCV_WS':
        // placeholder: ingestion service to be implemented
        break;
      case 'REVERIFY_API_ONLY':
        await reverify.run();
        break;
      default:
        break;
    }
    await queue.markDone(task.task_id);
  } catch (err: any) {
    await queue.markFailed(task.task_id, err?.message ?? 'failed');
  }
  return task;
}
