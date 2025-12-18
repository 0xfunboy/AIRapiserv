import { RequestMetricsRepository, TaskQueueRepository } from '@airapiserv/storage';
import { runNextTask } from './taskRunner.js';

const metrics = new RequestMetricsRepository();
const tasks = new TaskQueueRepository();

export function startIdleScheduler(logger: any, opts?: { intervalMs?: number; idleThreshold?: number }) {
  const intervalMs = opts?.intervalMs ?? 5000;
  const idleThreshold = opts?.idleThreshold ?? 5;

  const loop = async () => {
    try {
      const recent = await metrics.getRecent(1);
      const hasHighPriority = await tasks.hasHighPriorityPending();
      if (recent > idleThreshold || hasHighPriority) {
        return;
      }
      // jitter 1-3s to avoid stampede
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
      const task = await runNextTask();
      if (task) {
        logger.info?.({ task: task.type }, 'ran queued task');
      }
    } catch (err) {
      logger.error?.({ err }, 'idle scheduler loop failed');
    }
  };

  const timer = setInterval(loop, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
