import { TaskQueueRepository } from '@airapiserv/storage';
import { OhlcvService } from './ohlcvService.js';

type IngestPayload = { tokenId: string; timeframe: string; limit?: number };

export class IngestionService {
  private readonly ohlcv = new OhlcvService();
  private readonly tasks = new TaskQueueRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'ingestion' }) : console;
  }

  async ingestOhlcvApi(payload: IngestPayload) {
    if (!payload?.tokenId || !payload?.timeframe) return;
    const res = await this.ohlcv.fetchAndStore(payload.tokenId, payload.timeframe, payload.limit ?? 200);
    this.logger.info?.({ tokenId: payload.tokenId, timeframe: payload.timeframe, fetched: res.fetched }, 'ohlcv api ingest complete');
  }

  async scheduleOhlcvApi(payload: IngestPayload, priority = 120) {
    await this.tasks.enqueue({ type: 'INGEST_OHLCV_API', priority, payload });
  }
}
