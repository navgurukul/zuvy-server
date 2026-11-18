# Mentor Dashboard "You're not available for booking" bug

**Repo to fix:** `zuvy-client` only. Nothing in `zuvy-server` needs to change — backend data and endpoints are confirmed correct.

**Symptom:** A mentor with real, open, bookable slots (e.g. Vijay Vedantham, 12 open slots) sees "You're not available for booking yet" on their Dashboard tab, while a mentor with zero open slots (e.g. Ani-ket) sees a normal populated dashboard. The condition is effectively inverted relative to what the screen claims to check.

---

## Bug 1 — type/field mismatch

**File:** `zuvy-client/src/app/[admin]/mentorsDashboard/dashboard/page.tsx:204`

```ts
const upcomingSessionsCount = Number(metrics?.upcomingSessions) || 0;
```

`metrics.upcomingSessions` does not exist on the API response.

- Backend (`zuvy-server/src/controller/mentor-slot/metrics/mentor-metrics.service.ts:230-250`) returns `sessions.upcoming` (nested), never a top-level `upcomingSessions`.
- Frontend type (`zuvy-client/src/app/[admin]/hooks/hookType.ts:660-667`, `SessionMetrics`) doesn't declare `upcoming` at all — a stray top-level `upcomingSessions: string | number` was declared on `MentorMetrics` instead (`hookType.ts:683`).

Result: `metrics?.upcomingSessions` is always `undefined` → `upcomingSessionsCount` is always `0`, for every mentor, regardless of reality.

## Bug 2 — wrong condition entirely

**Same file, lines 205-210:**

```ts
const isEmptyDashboard =
  upcomingSessionsCount === 0 &&
  (Number(metrics?.sessions?.total) || 0) === 0 &&
  (Number(metrics?.sessions?.completed) || 0) === 0 &&
  upcomingSessions.length === 0 &&
  apiNotifications.length === 0;
```

This gates the "You're not available for booking yet" screen at **line 346**. It checks _booking/notification history_, never actual open-slot availability — despite the screen's own copy being entirely about slots.

The correct signal is already fetched and rendered elsewhere on the same page: `metrics.utilization.totalSlots`, lines 509-517 (it powers the "X of Y slots used" tile). Backend shape, confirmed at `mentor-metrics.service.ts:245-249`:

```ts
utilization: { totalSlots, usedSlots, utilizationRate: utilizationRate.toFixed(2) }
```

**Why it inverted for the two real cases:**

- Vijay: 12 open slots, 0 bookings ever → every one of the 5 conditions is true → wrongly shown the empty state.
- Ani-ket: 0 open slots, 2 completed sessions historically → `sessions.completed = 2` fails the check → correctly shown the normal dashboard.

The condition never once looks at slot count — it answers "has this mentor ever had activity?" not "does this mentor have open slots?".

**Supporting clue:** `page.tsx:25` has a commented-out `useMyMentorSlots` import — a real slot-count hook likely existed here before and was dropped. This looks like a regression, not original design.

---

## APIs involved (all confirmed correct — no backend changes needed)

| Hook                                            | Endpoint                                                        | Source                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useMentorMetrics`                              | `GET /instructor/mentor-slots/metrics`                          | `zuvy-client/src/app/[admin]/hooks/useMentorMetrics.ts:24` → backend `instructor-mentor-slot.controller.ts:367` → `mentor-metrics.service.ts:11` |
| `useMyMentorSessions(..., "upcoming", "asc")`   | `GET /instructor/mentor-sessions/my?filter=upcoming&sort=asc`   | `page.tsx:180-184`                                                                                                                               |
| `useMyMentorSessions(..., "completed", "desc")` | `GET /instructor/mentor-sessions/my?filter=completed&sort=desc` | `page.tsx:175-179`                                                                                                                               |

---

## Recommended fix

1. **`hookType.ts`** — move `upcoming` into `SessionMetrics`, drop the bogus top-level `upcomingSessions` from `MentorMetrics`.
2. **`page.tsx:204`** — `const upcomingSessionsCount = Number(metrics?.sessions?.upcoming) || 0`
3. **`page.tsx:205-210`** — replace the whole condition with an actual slot check:
   ```ts
   const isEmptyDashboard =
     (Number(metrics?.utilization?.totalSlots) || 0) === 0;
   ```
   Keep the existing "no upcoming sessions" empty state inside the Upcoming Sessions card as-is — that one is legitimately session-based and already works correctly on its own.
