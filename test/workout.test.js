import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceRunner, createRunner, readClocks, readSplits, restoreLegacyWorkout, runnerPhase, validWorkout,
} from "../public/workout.js";

test("both clocks run through the station and the next event starts at zero", () => {
  const runner = createRunner({ name: "Alex", color: "coral" }, 2);
  const other = createRunner({ name: "Sam", color: "mint" }, 2);
  advanceRunner(runner, 2, 2, 1000);
  assert.equal(runner.remaining, 2);
  assert.deepEqual(readClocks(other, 1000), { workout: 0, event: 0 });

  advanceRunner(runner, 2, 2, 6000);
  assert.equal(runner.remaining, 1);
  assert.equal(runnerPhase(runner), "running");
  advanceRunner(runner, 2, 2, 11000);
  assert.equal(runnerPhase(runner), "station");
  assert.deepEqual(readClocks(runner, 14500), { workout: 13, event: 13 });

  advanceRunner(runner, 2, 2, 15000);
  assert.equal(runnerPhase(runner), "running");
  assert.equal(runner.remaining, 2);
  assert.deepEqual(readClocks(runner, 15000), { workout: 14, event: 0 });
  assert.deepEqual(readSplits(runner), [{ run: 10, station: 4, total: 14 }]);

  advanceRunner(runner, 2, 2, 21000);
  advanceRunner(runner, 2, 2, 23000);
  advanceRunner(runner, 2, 2, 28000);
  assert.equal(runnerPhase(runner), "finished");
  advanceRunner(runner, 2, 2, 40000);
  assert.deepEqual(readClocks(runner, 40000), { workout: 27, event: 13 });
  assert.deepEqual(readSplits(runner), [{ run: 10, station: 4, total: 14 }, { run: 8, station: 5, total: 13 }]);
  assert.equal(runnerPhase(other), "ready");
});

test("whole-second splits reconcile with the workout after fractional taps", () => {
  const runner = createRunner({ name: "Jordan", color: "lilac" }, 1);
  for (const time of [600, 2500, 3700, 5600, 7900]) advanceRunner(runner, 1, 2, time);
  const splits = readSplits(runner);
  assert.equal(splits.length, 2);
  for (const split of splits) assert.equal(split.run + split.station, split.total);
  assert.equal(splits.reduce((sum, split) => sum + split.total, 0), readClocks(runner, 9000).workout);
  assert.ok(validWorkout(JSON.parse(JSON.stringify({ laps: 1, events: [2, 8], runners: [runner] }))));
});

test("old saved lap boards retain their timers and can finish and restart", () => {
  const workout = restoreLegacyWorkout({
    laps: 3,
    runners: [{ name: "Taylor", color: "gold", remaining: 1, startedAt: 1000, finishedAt: null }],
  });
  assert.deepEqual(workout.events, []);
  const [runner] = workout.runners;
  assert.equal(readClocks(runner, 6000).workout, 5);
  advanceRunner(runner, 3, 0, 7000);
  assert.equal(runnerPhase(runner), "finished");
  assert.equal(readClocks(runner, 9000).workout, 6);
  advanceRunner(runner, 3, 0, 10000);
  assert.equal(runner.remaining, 3);
  assert.equal(readClocks(runner, 10000).workout, 0);
  assert.ok(validWorkout(workout));
});

test("saved sessions require a valid event order and matching runner progress", () => {
  const runner = createRunner({ name: "Alex", color: "sky" }, 1);
  const workout = { laps: 1, events: [2, 4, 6, 8], runners: [runner] };
  assert.ok(validWorkout(workout));
  assert.equal(validWorkout({ ...workout, events: [4, 2] }), false);
  assert.equal(validWorkout({ ...workout, events: [2, 2] }), false);
  assert.equal(validWorkout({ ...workout, events: [9] }), false);
  advanceRunner(runner, 1, 4, 1000);
  advanceRunner(runner, 1, 4, 4000);
  assert.ok(validWorkout(workout));
  runner.runEndedAt = 500;
  assert.equal(validWorkout(workout), false);
});
