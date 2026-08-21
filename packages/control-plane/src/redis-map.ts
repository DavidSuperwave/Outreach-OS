/**
 * OD-20 Redis successor mapping — ratified once inside ADR-005.
 * Per-domain designs cite this table; they do not re-decide.
 */
export const REDIS_SUCCESSORS = {
  stream_transport: "queues_or_kernel_sessions",
  cancellation_pubsub: "do_alarms",
  counters: "do_storage_or_d1",
  work_sets: "do_storage_or_d1",
} as const;

export type RedisRole = keyof typeof REDIS_SUCCESSORS;
export type RedisSuccessor = (typeof REDIS_SUCCESSORS)[RedisRole];

export function redisSuccessor(role: RedisRole): RedisSuccessor {
  return REDIS_SUCCESSORS[role];
}
