import { Redis } from 'ioredis';

/**
 * VANTA Core SessionLaneQueue — Per-engagement serialization for attack execution
 * 
 * Extracted from Cephly SessionLaneQueue with engagement context:
 * - Lane ID pattern: {engagementId}:{targetId}
 * - Prevents race conditions when multiple tools target same asset
 * - Distributed locking for multi-instance coordination
 */

interface TaskEntry<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  createdAt: number;
  ttlMs: number;
}

interface LockState {
  laneId: string;
  lockKey: string;
  lockToken: string;
  acquiredAt: number;
}

export class SessionLaneQueue {
  private queues: Map<string, TaskEntry<unknown>[]> = new Map();
  private processing: Map<string, Promise<void>> = new Map();
  private activeLocks: Map<string, LockState> = new Map();
  private handler?: (payload: any) => Promise<any>;
  private redis: Redis | null = null;

  /** Default lock timeout: 30 seconds */
  private readonly DEFAULT_LOCK_TIMEOUT_MS = 30000;
  /** Max wait to acquire lock: 10 seconds */
  private readonly MAX_LOCK_WAIT_MS = 10000;
  /** Lock retry interval: 50ms */
  private readonly LOCK_RETRY_INTERVAL_MS = 50;
  /** Default task TTL: 5 minutes (stall prevention) */
  private readonly DEFAULT_TASK_TTL_MS = 300000;

  constructor(redis?: Redis) {
    this.redis = redis ?? null;
  }

  /**
   * Initialize with Redis client (required for distributed mode)
   */
  init(redis: Redis): void {
    this.redis = redis;
  }

  /**
   * Generate lane ID from engagement + target
   * Pattern: {engagementId}:{targetId}
   */
  static laneId(engagementId: string, targetId: string): string {
    return `${engagementId}:${targetId}`;
  }

  /**
   * Register the main execution handler (AgentBrain ReAct loop)
   */
  registerHandler(handler: (payload: any) => Promise<any>): void {
    this.handler = handler;
  }

  /**
   * Enqueue a task for serialized execution within an engagement lane
   */
  async enqueue<T>(
    engagementId: string, 
    targetId: string, 
    payload: any, 
    task: () => Promise<T>,
    ttlMs: number = this.DEFAULT_TASK_TTL_MS
  ): Promise<T> {
    const laneId = SessionLaneQueue.laneId(engagementId, targetId);
    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Persist to Redis if available (survives restart)
    if (this.redis) {
      await this.redis.rpush(`queue:${laneId}`, JSON.stringify({ taskId, payload, ttlMs }));
    }

    return new Promise<T>((resolve, reject) => {
      const entry: TaskEntry<T> = {
        task,
        resolve: resolve as (value: unknown) => void,
        reject,
        createdAt: Date.now(),
        ttlMs,
      };

      // Check TTL - reject expired tasks
      if (Date.now() - entry.createdAt > entry.ttlMs) {
        reject(new Error(`Task expired: TTL ${entry.ttlMs}ms exceeded`));
        return;
      }

      let queue = this.queues.get(laneId);
      if (!queue) {
        queue = [];
        this.queues.set(laneId, queue);
      }
      queue.push(entry as TaskEntry<unknown>);

      if (!this.processing.has(laneId)) {
        this.pump(laneId).catch((error) => {
          console.error(`[SessionLaneQueue] Pump error for lane ${laneId}:`, error);
        });
      }
    });
  }

  /**
   * Process tasks in queue for a lane (one at a time)
   */
  private async pump(laneId: string): Promise<void> {
    const processingPromise = (async () => {
      while (true) {
        // Acquire distributed lock before processing
        const lock = await this.acquireLock(laneId);
        if (!lock) {
          await this.sleep(this.LOCK_RETRY_INTERVAL_MS);
          continue;
        }

        try {
          let dataStr: string | null = null;
          if (this.redis) {
            dataStr = await this.redis.lpop(`queue:${laneId}`);
          }

          if (!dataStr) {
            const queue = this.queues.get(laneId);
            if (!queue || queue.length === 0) {
              this.queues.delete(laneId);
              break;
            }
          }

          let parsed: any;
          try {
            parsed = JSON.parse(dataStr || '{}');
          } catch {
            parsed = { taskId: dataStr };
          }
          const payload = parsed.payload;

          const queue = this.queues.get(laneId);
          const entry = queue ? queue.shift() : undefined;

          // Check TTL before execution
          if (entry && Date.now() - entry.createdAt > entry.ttlMs) {
            entry.reject(new Error(`Task expired: TTL ${entry.ttlMs}ms exceeded`));
            continue;
          }

          try {
            let result;
            if (entry) {
              result = await entry.task();
            } else if (this.handler && payload) {
              result = await this.handler(payload);
            } else {
              console.warn(`[SessionLane] Dropped task from lane ${laneId} — no handler`);
            }

            if (entry) entry.resolve(result);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (entry) entry.reject(err);
          }
        } finally {
          await this.releaseLock(lock);
        }
      }
    })();

    this.processing.set(laneId, processingPromise);
    try {
      await processingPromise;
    } finally {
      this.processing.delete(laneId);
    }
  }

  getQueueLength(laneId: string): number {
    const queue = this.queues.get(laneId);
    return queue ? queue.length : 0;
  }

  isProcessing(laneId: string): boolean {
    return this.processing.has(laneId);
  }

  isLocked(laneId: string): boolean {
    return this.activeLocks.has(laneId);
  }

  /**
   * Clear all queues and release locks (emergency stop)
   */
  async clear(): Promise<void> {
    const error = new Error('Queue cleared');
    for (const [, queue] of this.queues.entries()) {
      for (const entry of queue) {
        entry.reject(error);
      }
    }
    this.queues.clear();
    this.processing.clear();
    const lockReleases = Array.from(this.activeLocks.values()).map(lock => this.releaseLock(lock));
    await Promise.all(lockReleases);
  }

  getActiveLockCount(): number {
    return this.activeLocks.size;
  }

  getLockedLanes(): string[] {
    return Array.from(this.activeLocks.keys());
  }

  /**
   * Resume all persisted queues after restart
   */
  async resumeAll(): Promise<void> {
    if (!this.redis) return;
    
    const keys = await this.redis.keys('queue:*');
    for (const key of keys) {
      const laneId = key.substring(6);
      if (!this.processing.has(laneId)) {
        this.pump(laneId).catch(console.error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async acquireLock(laneId: string): Promise<LockState | null> {
    if (!this.redis) {
      // In-memory mode: always acquire
      const state = { 
        laneId, 
        lockKey: `lock:${laneId}`, 
        lockToken: Math.random().toString(36).substr(2, 9), 
        acquiredAt: Date.now() 
      };
      this.activeLocks.set(laneId, state);
      return state;
    }

    const lockKey = `lock:${laneId}`;
    const lockToken = Math.random().toString(36).substr(2, 9);
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', this.DEFAULT_LOCK_TIMEOUT_MS, 'NX');

    if (acquired === 'OK') {
      const state = { laneId, lockKey, lockToken, acquiredAt: Date.now() };
      this.activeLocks.set(laneId, state);
      return state;
    }
    return null;
  }

  private async releaseLock(lock: LockState): Promise<void> {
    if (!this.redis) {
      this.activeLocks.delete(lock.laneId);
      return;
    }

    const currentToken = await this.redis.get(lock.lockKey);
    if (currentToken === lock.lockToken) {
      await this.redis.del(lock.lockKey);
    }
    this.activeLocks.delete(lock.laneId);
  }
}

// Singleton export
let _globalLane: SessionLaneQueue | null = null;

export function setGlobalLane(lane: SessionLaneQueue): void {
  _globalLane = lane;
}

export function getGlobalLane(): SessionLaneQueue {
  if (!_globalLane) throw new Error('GlobalLane not initialized');
  return _globalLane;
}
