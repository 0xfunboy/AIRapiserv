import { TaskQueueRepository } from '@airapiserv/storage';
import { DiscoveryService } from './discoveryService.js';
import { VenueSyncService } from './venueSyncService.js';
import { CoverageService } from './coverageService.js';

const discovery = new DiscoveryService();
const venueSync = new VenueSyncService();
const coverage = new CoverageService();
const queue = new TaskQueueRepository();

export async function runNextTask() {
  const task = await queue.fetchNext();
  if (!task) return null;
  try {
    switch (task.type) {
      case 'DISCOVER_TOKENS_API':
        await discovery.run();
        break;
      case 'SYNC_VENUE_MARKETS':
        await venueSync.run();
        break;
      case 'RESOLVE_TOKEN_VENUES':
        await coverage.run();
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
