import { getPgPool } from '../clients/postgresClient.js';

export type TaskRecord = {
  taskId?: string;
  type: string;
  priority?: number;
  payload?: Record<string, unknown>;
  runAfter?: Date | null;
};

export class TaskQueueRepository {
  private readonly pg = getPgPool();

  async enqueue(task: TaskRecord) {
    const sql = `
      insert into tasks (task_id, type, priority, payload, run_after, status, attempts, created_at, updated_at)
      values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, 'pending', 0, now(), now())
      on conflict (task_id) do nothing
      returning task_id`;
    const result = await this.pg.query(sql, [
      task.taskId ?? null,
      task.type,
      task.priority ?? 10,
      task.payload ?? {},
      task.runAfter ?? null,
    ]);
    return result.rows?.[0]?.task_id as string | undefined;
  }

  async fetchNext(now = new Date()) {
    const sql = `
      update tasks t
      set status = 'running', updated_at = now(), attempts = attempts + 1
      where t.task_id = (
        select task_id
        from tasks
        where status = 'pending'
          and (run_after is null or run_after <= $1)
        order by priority desc, coalesce(run_after, now())
        limit 1
        for update skip locked
      )
      returning *;`;
    const result = await this.pg.query(sql, [now]);
    return result.rows?.[0] ?? null;
  }

  async hasHighPriorityPending(minPriority = 100) {
    const res = await this.pg.query(
      `select 1 from tasks where status = 'pending' and priority >= $1 limit 1`,
      [minPriority]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async markDone(taskId: string) {
    await this.pg.query(`update tasks set status='done', updated_at=now() where task_id=$1`, [taskId]);
  }

  async markFailed(taskId: string, error: string) {
    await this.pg.query(`update tasks set status='failed', last_error=$2, updated_at=now() where task_id=$1`, [taskId, error]);
  }
}
