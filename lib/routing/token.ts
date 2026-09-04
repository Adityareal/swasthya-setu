/**
 * Token_Number.
 *
 * With a single-client in-memory store, THIS IS THE IMPLEMENTATION, not a
 * mirror of one. `memoryRepo.bookAppointment()` reads the token numbers already
 * held at that facility, calls `nextTokenFrom`, and writes the row — all inside
 * one synchronous JavaScript turn, on a single thread, against a store with
 * exactly one writer. There is no read-modify-write window because nothing can
 * interleave between the read and the write, so there is no race to defend
 * against and the unit test covers the code that actually runs.
 *
 * A real deployment reintroduces the race: two ASHAs submitting to CHC Wardha
 * in the same second both read 13 and both write 14, and two patients holding
 * token 14 is a real defect in a queue-management product. The fix is
 * (1) this function stays, unchanged, as the rule the storage layer must
 * uphold, and (2) a uniqueness constraint on `(facility_id, token_number)`
 * plus computing and inserting in a single statement so no client round trip
 * sits between the two. Serialisation (an advisory lock, a transaction) keeps
 * the constraint from being hit; it is not a substitute for it.
 *
 * Derived from `max`, not from a counter, so order-independent and
 * duplicate-safe: `[] → 1`, `[3,1,2,2] → 4`, `[13..1] → 14`.
 */
export function nextTokenFrom(existing: number[]): number {
  let max = 0;
  for (const n of existing ?? []) {
    if (Number.isFinite(n) && n > max) max = Math.floor(n);
  }
  return max + 1;
}
