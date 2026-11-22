export const palette = new Map([
  ["coral", "Coral"],
  ["lilac", "Lilac"],
  ["mint", "Mint"],
  ["gold", "Gold"],
  ["sky", "Sky"],
  ["pink", "Pink"],
  ["lime", "Lime"],
  ["teal", "Teal"],
]);

export const events = new Map([
  [1, { distance: "1,000 m", station: "SkiErg" }],
  [2, { distance: "50 m", station: "Sled Push" }],
  [3, { distance: "50 m", station: "Sled Pull" }],
  [4, { distance: "80 m", station: "Burpee Broad Jumps" }],
  [5, { distance: "1,000 m", station: "Rowing" }],
  [6, { distance: "200 m", station: "Farmers Carry" }],
  [7, { distance: "100 m", station: "Sandbag Lunges" }],
  [8, { distance: "100", station: "Wall Balls" }],
]);

export function stationLabel(event) {
  return `${event.distance} ${event.station}`;
}

export function createRunner({ name, color }, laps) {
  return { name: name.trim(), color, remaining: laps, startedAt: null, runEndedAt: null, finishedAt: null, splits: [] };
}

export function runnerPhase(runner) {
  if (runner.startedAt === null) return "ready";
  if (runner.finishedAt !== null) return "finished";
  return runner.runEndedAt === null ? "running" : "station";
}

function eventStart(runner, index) {
  return index > 0 ? runner.splits[index - 1].endedAt : runner.startedAt;
}

export function advanceRunner(runner, laps, eventCount, now) {
  const phase = runnerPhase(runner);
  if (phase === "ready" || (phase === "finished" && eventCount === 0)) {
    runner.startedAt = now;
    runner.finishedAt = null;
    runner.remaining = laps;
    return;
  }
  if (phase === "finished") return;

  if (phase === "station") {
    const endedAt = Math.max(now, runner.runEndedAt);
    runner.splits.push({ runEndedAt: runner.runEndedAt, endedAt });
    runner.runEndedAt = null;
    if (runner.splits.length === eventCount) runner.finishedAt = endedAt;
    else runner.remaining = laps;
    return;
  }

  runner.remaining -= 1;
  if (runner.remaining === 0) {
    const runEndedAt = Math.max(now, eventStart(runner, runner.splits.length));
    if (eventCount > 0) runner.runEndedAt = runEndedAt;
    else runner.finishedAt = runEndedAt;
  }
}

// Use the same whole-second workout offsets for live clocks and saved splits.
// The displayed run and station times then add up to the displayed totals.
function workoutSeconds(runner, timestamp) {
  return Math.max(0, Math.floor((timestamp - runner.startedAt) / 1000));
}

export function readClocks(runner, now) {
  if (runner.startedAt === null) return { workout: 0, event: 0 };
  const finished = runner.finishedAt !== null;
  const index = Math.max(0, runner.splits.length - (finished ? 1 : 0));
  const start = eventStart(runner, index);
  const end = runner.finishedAt ?? Math.max(now, runner.runEndedAt ?? start);
  const workout = workoutSeconds(runner, end);
  return { workout, event: workout - workoutSeconds(runner, start) };
}

export function readSplits(runner) {
  return runner.splits.map(({ runEndedAt, endedAt }, index) => {
    const start = workoutSeconds(runner, eventStart(runner, index));
    const run = workoutSeconds(runner, runEndedAt);
    const end = workoutSeconds(runner, endedAt);
    return { run: run - start, station: end - run, total: end - start };
  });
}

export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

function validRunner(runner, laps, eventCount) {
  if (!runner || typeof runner.name !== "string" || !runner.name.trim() || !palette.has(runner.color)) return false;
  if (!Number.isInteger(runner.remaining) || runner.remaining < 0 || runner.remaining > laps) return false;
  if (!Array.isArray(runner.splits) || runner.splits.length > eventCount) return false;

  if (runner.startedAt === null) {
    return runner.remaining === laps && runner.runEndedAt === null && runner.finishedAt === null && runner.splits.length === 0;
  }
  if (!Number.isFinite(runner.startedAt)) return false;

  let lastEnd = runner.startedAt;
  for (const split of runner.splits) {
    if (!split || !Number.isFinite(split.runEndedAt) || !Number.isFinite(split.endedAt)) return false;
    if (split.runEndedAt < lastEnd || split.endedAt < split.runEndedAt) return false;
    lastEnd = split.endedAt;
  }

  if (runner.finishedAt !== null) {
    return runner.remaining === 0 && runner.runEndedAt === null &&
      (eventCount > 0
        ? runner.splits.length === eventCount && runner.finishedAt === lastEnd
        : Number.isFinite(runner.finishedAt) && runner.finishedAt >= lastEnd);
  }
  if (eventCount > 0 && runner.splits.length === eventCount) return false;
  if (runner.runEndedAt !== null) {
    return eventCount > 0 && runner.remaining === 0 && Number.isFinite(runner.runEndedAt) && runner.runEndedAt >= lastEnd;
  }
  return runner.remaining > 0;
}

export function validWorkout(workout) {
  if (!workout || !Number.isInteger(workout.laps) || workout.laps < 1 || workout.laps > 999) return false;
  if (!Array.isArray(workout.events) || !workout.events.every((id, index, ids) => events.has(id) && (index === 0 || ids[index - 1] < id))) return false;
  return Array.isArray(workout.runners) && workout.runners.length > 0 && workout.runners.length <= palette.size &&
    workout.runners.every((runner) => validRunner(runner, workout.laps, workout.events.length));
}

export function restoreLegacyWorkout(saved) {
  if (!saved || !Array.isArray(saved.runners)) return null;
  const workout = {
    laps: saved.laps,
    events: [],
    runners: saved.runners.map((runner) => ({ ...runner, runEndedAt: null, splits: [] })),
  };
  return validWorkout(workout) ? workout : null;
}
