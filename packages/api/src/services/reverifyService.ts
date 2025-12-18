import { CoverageService } from './coverageService.js';
import { TaskQueueRepository } from '@airapiserv/storage';

export class ReverifyService {
  private readonly coverage = new CoverageService();
  private readonly tasks = new TaskQueueRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'reverify' }) : console;
  }

  async run() {
    await this.coverage.run();
    // schedule next reverify in 24h
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.tasks.enqueue({ type: 'REVERIFY_API_ONLY', priority: 15, runAfter: next });
    this.logger.info?.({ next }, 'reverify complete, next scheduled');
  }
}
