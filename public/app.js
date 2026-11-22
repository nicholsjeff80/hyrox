import {
  advanceRunner, createRunner, events, formatTime, palette, readClocks, readSplits,
  restoreLegacyWorkout, runnerPhase, stationLabel, validWorkout,
} from "./workout.js";

const storageKey = "lord-of-the-hyrox:board:v2";
const legacyStorageKey = "lord-of-the-hyrox:board:v1";
const defaultLaps = 12;
const defaultParticipants = 4;
const presets = [
  { label: "1–4", ids: [1, 2, 3, 4] },
  { label: "2 · 4 · 6 · 8", ids: [2, 4, 6, 8] },
  { label: "5–8", ids: [5, 6, 7, 8] },
];

const screens = {
  roster: document.getElementById("setup-screen"),
  events: document.getElementById("events-screen"),
  review: document.getElementById("review-screen"),
  start: document.getElementById("start-screen"),
  board: document.getElementById("board-screen"),
  results: document.getElementById("results-screen"),
};
const setupForm = document.getElementById("setup-form");
const roster = document.getElementById("roster");
const participantCount = document.getElementById("participant-count");
const lapCount = document.getElementById("lap-count");
const fewerLaps = document.getElementById("fewer-laps");
const moreLaps = document.getElementById("more-laps");
const setupNextLabel = document.getElementById("setup-next-label");
const backToBoard = document.getElementById("back-to-board");
const restartApp = document.getElementById("restart-app");
const fieldTemplate = document.getElementById("runner-field-template");

const eventOptions = document.getElementById("event-options");
const eventPresets = document.getElementById("event-presets");
const reviewEvents = document.getElementById("review-events");
const reviewEventsLabel = document.getElementById("review-events-label");
const boardLaps = document.getElementById("board-laps");
const runnerBoard = document.getElementById("runner-board");
const announcement = document.getElementById("announcement");
const tileTemplate = document.getElementById("runner-tile-template");

let board = readBoard();
let draft = [];
let selectedEvents = new Set();
let editingRoster = false;
let openPicker = null;
let tiles = [];

function readBoard() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) return restoreLegacyWorkout(JSON.parse(localStorage.getItem(legacyStorageKey)));
    const saved = JSON.parse(stored);
    return validWorkout(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveBoard() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(board));
    localStorage.removeItem(legacyStorageKey);
  } catch {
    // Timing continues even when storage is unavailable.
  }
}

function updateLapControls() {
  fewerLaps.disabled = lapCount.valueAsNumber === Number(lapCount.min);
  moreLaps.disabled = lapCount.valueAsNumber === Number(lapCount.max);
}

function adjustLaps(change) {
  const value = lapCount.valueAsNumber;
  const previous = Number.isFinite(value) ? Math.trunc(value) : defaultLaps;
  lapCount.value = Math.min(Number(lapCount.max), Math.max(Number(lapCount.min), previous + change));
  updateLapControls();
}

function closeColorPicker() {
  if (!openPicker) return;
  openPicker.panel.hidden = true;
  openPicker.button.setAttribute("aria-expanded", "false");
  openPicker = null;
}

function renderRoster() {
  closeColorPicker();
  const rows = activeRunners().map(makeRunnerField);
  roster.replaceChildren(...rows);
}

function makeRunnerField(runner, index) {
  const field = fieldTemplate.content.firstElementChild.cloneNode(true);
  const name = field.querySelector(".runner-name");
  const button = field.querySelector(".color-picker-button");
  const panel = field.querySelector(".color-picker");
  const pickerLabel = field.querySelector(".picker-label");
  const choices = field.querySelector(".color-options");
  const fallbackName = `Runner ${index + 1}`;

  name.placeholder = fallbackName;
  name.value = runner.name;
  name.setAttribute("aria-label", `${fallbackName} name`);
  panel.id = `runner-color-${index + 1}`;
  pickerLabel.id = `${panel.id}-label`;
  panel.setAttribute("aria-labelledby", pickerLabel.id);
  button.setAttribute("aria-controls", panel.id);

  function updateColorLabels() {
    const displayName = runner.name.trim() || fallbackName;
    button.dataset.color = runner.color;
    button.setAttribute("aria-label", `Choose color for ${displayName}. ${palette.get(runner.color)} selected.`);
    pickerLabel.textContent = `Color for ${displayName}`;
    for (const choice of choices.children) {
      choice.setAttribute("aria-pressed", String(choice.dataset.color === runner.color));
    }
  }

  for (const [color, label] of palette) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "color-option";
    choice.dataset.color = color;
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.setAttribute("aria-hidden", "true");
    choice.append(swatch, label);
    choice.addEventListener("click", () => {
      runner.color = color;
      updateColorLabels();
      closeColorPicker();
      button.focus({ preventScroll: true });
    });
    choices.append(choice);
  }

  button.addEventListener("click", () => {
    const wasOpen = !panel.hidden;
    closeColorPicker();
    if (!wasOpen) {
      openPicker = { panel, button };
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
    }
  });
  name.addEventListener("input", () => {
    runner.name = name.value;
    name.setCustomValidity("");
    updateColorLabels();
  });
  updateColorLabels();
  return field;
}

function activeRunners() {
  return draft.slice(0, Number(participantCount.value));
}

function eventIds() {
  return [...events.keys()].filter((id) => selectedEvents.has(id));
}

function showScreen(name, focus = true) {
  const current = screens[name];
  for (const screen of Object.values(screens)) screen.hidden = screen !== current;
  if (focus) {
    window.scrollTo(0, 0);
    document.getElementById(current.getAttribute("aria-labelledby")).focus({ preventScroll: true });
  }
}

function showSetup(focus = true) {
  draft = Array.from(palette.keys(), (color, index) => {
    const saved = board?.runners[index];
    return saved ? { name: saved.name, color: saved.color } : { name: "", color };
  });
  selectedEvents = new Set(board?.events ?? []);
  editingRoster = false;
  setupNextLabel.textContent = "Choose events";
  participantCount.value = board?.runners.length ?? defaultParticipants;
  lapCount.value = board?.laps ?? defaultLaps;
  backToBoard.hidden = !board;
  restartApp.hidden = !board;
  renderRoster();
  updateLapControls();
  showScreen("roster", focus);
}

function lapLabel(count) {
  return `${count} ${count === 1 ? "lap" : "laps"}`;
}

function eventLabel(count) {
  return `${count} ${count === 1 ? "event" : "events"}`;
}

function eventNumber(id) {
  const number = document.createElement("span");
  number.className = "event-number";
  number.textContent = id;
  return number;
}

function updateEventSelection() {
  for (const input of eventOptions.querySelectorAll("input")) {
    input.checked = selectedEvents.has(Number(input.value));
    input.closest(".event-option").classList.toggle("is-selected", input.checked);
  }
  Array.from(eventPresets.children).forEach((button, index) => {
    const ids = presets[index].ids;
    const matches = ids.length === selectedEvents.size && ids.every((id) => selectedEvents.has(id));
    button.setAttribute("aria-pressed", String(matches));
  });
  reviewEvents.disabled = selectedEvents.size === 0;
  reviewEventsLabel.textContent = selectedEvents.size ? `Review ${eventLabel(selectedEvents.size)}` : "Review events";
}

function buildEventChoices() {
  for (const { label, ids } of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-action";
    button.textContent = label;
    button.setAttribute("aria-label", `Select events ${ids.join(", ")}`);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      selectedEvents = new Set(ids);
      updateEventSelection();
    });
    eventPresets.append(button);
  }
  for (const [id, event] of events) {
    const row = document.createElement("li");
    const label = document.createElement("label");
    label.className = "event-option";
    const name = document.createElement("span");
    name.textContent = stationLabel(event);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = id;
    input.setAttribute("aria-label", `Event ${id}, ${name.textContent}`);
    input.addEventListener("change", () => {
      if (input.checked) selectedEvents.add(id);
      else selectedEvents.delete(id);
      updateEventSelection();
    });
    label.append(eventNumber(id), name, input);
    row.append(label);
    eventOptions.append(row);
  }
}

function showEvents() {
  updateEventSelection();
  showScreen("events");
}

function showReview() {
  const names = activeRunners().map(({ name, color }) => {
    const item = document.createElement("li");
    item.dataset.color = color;
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, name.trim());
    return item;
  });
  document.getElementById("review-roster").replaceChildren(...names);

  const order = eventIds().map((id) => {
    const item = document.createElement("li");
    const pair = document.createElement("span");
    const run = document.createElement("span");
    run.className = "review-run";
    run.textContent = "1 km Run → ";
    pair.append(run, stationLabel(events.get(id)));
    item.append(eventNumber(id), pair);
    return item;
  });
  document.getElementById("review-order").replaceChildren(...order);
  const laps = lapCount.valueAsNumber;
  document.getElementById("review-distance").textContent = `${order.length} km of running per runner`;
  document.getElementById("review-laps").textContent = `${lapLabel(laps)} per run · ${lapLabel(laps * order.length)} total`;
  showScreen("review");
}

function showStart() {
  const first = eventIds()[0];
  document.getElementById("first-event-number").textContent = `First up · Event ${first}`;
  document.getElementById("first-event-laps").textContent = lapLabel(lapCount.valueAsNumber);
  document.getElementById("first-event-station").textContent = `Then ${stationLabel(events.get(first))}`;
  document.getElementById("start-session-label").textContent = board ? "Start new session" : "Start session";
  showScreen("start");
}

function startSession() {
  const laps = lapCount.valueAsNumber;
  board = { laps, events: eventIds(), runners: activeRunners().map((runner) => createRunner(runner, laps)) };
  saveBoard();
  showBoard();
}

function writeClocks(tile, times) {
  const workout = formatTime(times.workout);
  const event = formatTime(times.event);
  if (tile.workoutClock.textContent !== workout) tile.workoutClock.textContent = workout;
  if (tile.eventClock.textContent !== event) tile.eventClock.textContent = event;
}

function refreshTile(tile, now) {
  const { runner, button } = tile;
  const totalEvents = board.events.length;
  const phase = runnerPhase(runner);
  const finished = phase === "finished";
  const last = phase === "running" && runner.remaining === 1;
  const round = Math.min(runner.splits.length + 1, totalEvents);
  const current = events.get(board.events[round - 1]);
  const times = readClocks(runner, now);

  let value = runner.remaining;
  let stage = totalEvents ? `Run ${round} of ${totalEvents}` : "";
  let state = "Laps left";
  let cue = current ? "Next" : "";
  let instruction = current ? stationLabel(current) : "";
  let description = `${lapLabel(runner.remaining)} left. Tap to count a lap.`;

  if (phase === "ready") {
    state = "Tap to start";
    description = `${lapLabel(board.laps)} total. Tap to start.`;
  } else if (last) {
    state = "Last lap";
    description = totalEvents ? "Last lap. Tap to start the station." : "Last lap. Tap to finish.";
  } else if (phase === "station") {
    value = current.distance;
    stage = `Station ${round} of ${totalEvents}`;
    state = current.station;
    cue = "";
    instruction = round === totalEvents ? "Tap after the station to finish" : "Tap after the station";
    description = `${stationLabel(current)}. ${instruction}.`;
  } else if (finished) {
    cue = "";
    if (totalEvents) {
      value = formatTime(times.workout);
      stage = `${totalEvents} of ${eventLabel(totalEvents)}`;
      state = "Workout finished";
      instruction = "View splits";
      description = `Workout finished in ${value}. View splits.`;
    } else {
      state = "Finished";
      instruction = "Tap to restart";
      description = `Finished in ${formatTime(times.workout)}. Tap to restart.`;
    }
  }

  button.dataset.phase = phase;
  tile.count.textContent = value;
  tile.phaseLabel.textContent = stage;
  tile.phaseLabel.hidden = !stage;
  tile.state.textContent = state;
  tile.state.classList.toggle("is-callout", phase === "ready" || last);
  tile.workout.hidden = finished && totalEvents > 0;
  tile.event.hidden = totalEvents === 0;
  tile.eventLabel.textContent = finished ? "Last event" : "Event";
  tile.clocks.classList.toggle("single-clock", finished || totalEvents === 0);
  tile.marks.hidden = totalEvents > 0 || finished;
  tile.marks.style.setProperty("--completed", `${100 * (board.laps - runner.remaining) / board.laps}%`);
  tile.cue.textContent = cue;
  tile.cue.hidden = !cue;
  tile.instruction.textContent = instruction;
  tile.arrow.hidden = !finished || totalEvents === 0;
  tile.footer.hidden = !instruction;
  tile.footer.classList.toggle("is-splits-link", !tile.arrow.hidden);
  const label = `${runner.name}. ${stage ? `${stage}. ` : ""}${description}`;
  button.setAttribute("aria-label", label);
  writeClocks(tile, times);
  return label;
}

function recordTap(tile) {
  if (board.events.length && runnerPhase(tile.runner) === "finished") {
    showResults(tile.runner);
    return;
  }
  const now = Date.now();
  advanceRunner(tile.runner, board.laps, board.events.length, now);
  saveBoard();
  announcement.textContent = refreshTile(tile, now);
}

function makeTile(runner, index, now) {
  const button = tileTemplate.content.firstElementChild.cloneNode(true);
  const tile = {
    runner,
    button,
    count: button.querySelector(".tile-count"),
    phaseLabel: button.querySelector(".tile-phase"),
    state: button.querySelector(".tile-state"),
    clocks: button.querySelector(".tile-clocks"),
    workout: button.querySelector(".tile-workout"),
    event: button.querySelector(".tile-event"),
    eventLabel: button.querySelector(".event-clock-label"),
    workoutClock: button.querySelector(".workout-clock"),
    eventClock: button.querySelector(".event-clock"),
    marks: button.querySelector(".tile-progress"),
    footer: button.querySelector(".tile-footer"),
    cue: button.querySelector(".tile-cue"),
    instruction: button.querySelector(".tile-instruction"),
    arrow: button.querySelector(".tile-arrow"),
  };
  button.dataset.color = runner.color;
  button.classList.toggle("legacy-tile", board.events.length === 0);
  button.querySelector(".tile-name").textContent = runner.name;
  if (board.events.length === 0) tile.workout.querySelector(".clock-label").textContent = "Time";
  tile.clocks.id = `runner-clocks-${index + 1}`;
  button.setAttribute("aria-describedby", tile.clocks.id);
  tile.marks.classList.toggle("is-segmented", board.laps <= 24);
  tile.marks.style.setProperty("--target-laps", board.laps);
  button.addEventListener("click", () => recordTap(tile));
  refreshTile(tile, now);
  return tile;
}

function showBoard(focus = true) {
  const now = Date.now();
  closeColorPicker();
  boardLaps.textContent = board.events.length
    ? `${eventLabel(board.events.length)} · ${lapLabel(board.laps)} per run`
    : `${lapLabel(board.laps)} per runner`;
  runnerBoard.dataset.count = board.runners.length;
  tiles = board.runners.map((runner, index) => makeTile(runner, index, now));
  runnerBoard.replaceChildren(...tiles.map((tile) => tile.button));
  announcement.textContent = "";
  showScreen("board", focus);
}

function showResults(runner) {
  document.getElementById("workout-total").dataset.color = runner.color;
  document.getElementById("results-title").textContent = runner.name;
  document.getElementById("results-time").textContent = formatTime(readClocks(runner, Date.now()).workout);
  document.getElementById("results-event-count").textContent = `${eventLabel(runner.splits.length)} completed`;
  const rows = readSplits(runner).map(({ run, station, total }, index) => {
    const id = board.events[index];
    const row = document.createElement("tr");
    const title = document.createElement("th");
    title.scope = "row";
    title.append(eventNumber(id), ` ${stationLabel(events.get(id))}`);
    row.append(title);
    for (const seconds of [run, station, total]) {
      const cell = document.createElement("td");
      cell.textContent = formatTime(seconds);
      row.append(cell);
    }
    return row;
  });
  document.getElementById("split-rows").replaceChildren(...rows);
  showScreen("results");
}

function updateClocks() {
  if (screens.board.hidden) return;
  const now = Date.now();
  for (const tile of tiles) {
    if (tile.runner.startedAt !== null && tile.runner.finishedAt === null) {
      writeClocks(tile, readClocks(tile.runner, now));
    }
  }
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const invalidName = activeRunners().findIndex((runner) => !runner.name.trim());
  if (invalidName !== -1) {
    const input = roster.querySelectorAll(".runner-name")[invalidName];
    input.setCustomValidity("Enter a name for this runner.");
    input.reportValidity();
    return;
  }
  closeColorPicker();
  if (editingRoster) showReview();
  else showEvents();
});

setupForm.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openPicker) {
    const { button } = openPicker;
    closeColorPicker();
    button.focus({ preventScroll: true });
  }
});

participantCount.addEventListener("change", renderRoster);
lapCount.addEventListener("input", updateLapControls);
fewerLaps.addEventListener("click", () => adjustLaps(-1));
moreLaps.addEventListener("click", () => adjustLaps(1));
document.getElementById("edit-setup").addEventListener("click", () => showSetup());
document.getElementById("back-to-roster").addEventListener("click", () => {
  editingRoster = false;
  setupNextLabel.textContent = "Choose events";
  showScreen("roster");
});
document.getElementById("edit-roster").addEventListener("click", () => {
  editingRoster = true;
  setupNextLabel.textContent = "Return to review";
  showScreen("roster");
});
reviewEvents.addEventListener("click", showReview);
document.getElementById("back-to-events").addEventListener("click", showEvents);
document.getElementById("edit-events").addEventListener("click", showEvents);
document.getElementById("continue-to-start").addEventListener("click", showStart);
document.getElementById("back-to-review").addEventListener("click", showReview);
document.getElementById("start-session").addEventListener("click", startSession);
document.getElementById("results-back").addEventListener("click", () => showBoard());
backToBoard.addEventListener("click", () => showBoard());
restartApp.addEventListener("click", () => {
  if (!window.confirm("Restart the app? This clears the roster, lap count, and stopwatch times saved on this device.")) return;
  board = null;
  saveBoard();
  tiles = [];
  runnerBoard.replaceChildren();
  announcement.textContent = "";
  showSetup();
});

for (let count = 1; count <= palette.size; count += 1) {
  participantCount.add(new Option(String(count), String(count)));
}
buildEventChoices();
if (board) showBoard(false);
else showSetup(false);
window.setInterval(updateClocks, 150);
document.addEventListener("visibilitychange", updateClocks);
