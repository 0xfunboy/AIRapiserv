import { getPgPool } from '../clients/postgresClient.js';

export class RequestMetricsRepository {
  private readonly pg = getPgPool();

  async increment(bucketStart: Date) {
    await this.pg.query(
      `insert into request_metrics (bucket_start, request_count)
       values ($1, 1)
       on conflict (bucket_start) do update set request_count = request_metrics.request_count + 1`,
      [bucketStart]
    );
  }

  async getRecent(totalMinutes = 60) {
    const res = await this.pg.query(
      `select sum(request_count) as count from request_metrics where bucket_start >= (now() - ($1 || ' minutes')::interval)`,
      [totalMinutes]
    );
    return Number(res.rows?.[0]?.count ?? 0);
  }
}
