"use strict";

const palette = new Map([
  ["coral", "Coral"],
  ["lilac", "Lilac"],
  ["mint", "Mint"],
  ["gold", "Gold"],
  ["sky", "Sky"],
  ["pink", "Pink"],
  ["lime", "Lime"],
  ["teal", "Teal"],
]);
const storageKey = "lord-of-the-hyrox:board:v1";
const defaultLaps = 12;
const defaultParticipants = 4;

const setupScreen = document.getElementById("setup-screen");
const setupTitle = document.getElementById("setup-title");
const setupForm = document.getElementById("setup-form");
const roster = document.getElementById("roster");
const participantCount = document.getElementById("participant-count");
const lapCount = document.getElementById("lap-count");
const fewerLaps = document.getElementById("fewer-laps");
const moreLaps = document.getElementById("more-laps");
const openBoardLabel = document.getElementById("open-board-label");
const backToBoard = document.getElementById("back-to-board");
const restartApp = document.getElementById("restart-app");
const editSetup = document.getElementById("edit-setup");
const fieldTemplate = document.getElementById("runner-field-template");

const boardScreen = document.getElementById("board-screen");
const boardTitle = document.getElementById("board-title");
const boardLaps = document.getElementById("board-laps");
const runnerBoard = document.getElementById("runner-board");
const announcement = document.getElementById("announcement");
const tileTemplate = document.getElementById("runner-tile-template");

let board = readBoard();
let draft = [];
let openPicker = null;
let tiles = [];

function validLaps(value) {
  return Number.isInteger(value) && value >= Number(lapCount.min) && value <= Number(lapCount.max);
}

function validRunner(runner, laps) {
  if (!runner || typeof runner.name !== "string" || !runner.name.trim() || !palette.has(runner.color)) {
    return false;
  }
  if (!Number.isInteger(runner.remaining) || runner.remaining < 0 || runner.remaining > laps) {
    return false;
  }
  if (runner.startedAt === null) {
    return runner.remaining === laps && runner.finishedAt === null;
  }
  if (!Number.isFinite(runner.startedAt)) {
    return false;
  }
  return runner.remaining === 0
    ? Number.isFinite(runner.finishedAt) && runner.finishedAt >= runner.startedAt
    : runner.finishedAt === null;
}

function readBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && validLaps(saved.laps) && Array.isArray(saved.runners) &&
        saved.runners.length > 0 && saved.runners.length <= palette.size &&
        saved.runners.every((runner) => validRunner(runner, saved.laps))) {
      return saved;
    }
  } catch {
    // Blocked storage or an invalid save still allows a new board.
  }
  return null;
}

function saveBoard() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(board));
  } catch {
    // Timing continues even when storage is unavailable.
  }
}

function setupMatchesBoard() {
  return board && board.laps === lapCount.valueAsNumber &&
    board.runners.length === Number(participantCount.value) &&
    board.runners.every((runner, index) => (
      runner.name === draft[index].name.trim() && runner.color === draft[index].color
    ));
}

function updateSetupAction() {
  openBoardLabel.textContent = board && !setupMatchesBoard() ? "Start new board" : "Open lap board";
}

function updateLapControls() {
  fewerLaps.disabled = lapCount.valueAsNumber === Number(lapCount.min);
  moreLaps.disabled = lapCount.valueAsNumber === Number(lapCount.max);
  updateSetupAction();
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
  const rows = draft.slice(0, Number(participantCount.value)).map(makeRunnerField);
  roster.replaceChildren(...rows);
  updateSetupAction();
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
      updateSetupAction();
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
    updateSetupAction();
  });
  updateColorLabels();
  return field;
}

function showSetup() {
  draft = Array.from(palette.keys(), (color, index) => {
    const saved = board?.runners[index];
    return saved ? { name: saved.name, color: saved.color } : { name: "", color };
  });
  participantCount.value = board?.runners.length ?? defaultParticipants;
  lapCount.value = board?.laps ?? defaultLaps;
  backToBoard.hidden = !board;
  if (restartApp) restartApp.hidden = !board;
  renderRoster();
  updateLapControls();
  setupScreen.hidden = false;
  boardScreen.hidden = true;
}

function focusScreen(title) {
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

function lapLabel(count) {
  return `${count} ${count === 1 ? "lap" : "laps"}`;
}

function formatTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

function readTime(runner, now) {
  return runner.startedAt === null ? "00:00" : formatTime((runner.finishedAt ?? now) - runner.startedAt);
}

function refreshTile(tile, now) {
  const { runner, button, count, clock, state, marks, restart } = tile;
  const ready = runner.startedAt === null;
  const finished = runner.finishedAt !== null;
  const last = !ready && runner.remaining === 1;

  count.textContent = runner.remaining;
  clock.textContent = readTime(runner, now);
  state.textContent = finished ? "Finished" : ready ? "Tap to start" : last ? "Last lap" : "Laps left";
  state.classList.toggle("is-callout", ready || last);
  button.classList.toggle("is-finished", finished);
  marks.hidden = finished;
  restart.hidden = !finished;
  marks.style.setProperty("--completed", `${100 * (board.laps - runner.remaining) / board.laps}%`);

  let label = `${runner.name}. ${lapLabel(runner.remaining)} left. Tap to count a lap.`;
  if (ready) label = `${runner.name}. ${lapLabel(board.laps)} total. Tap to start.`;
  if (last) label = `${runner.name}. Last lap. Tap to finish.`;
  if (finished) label = `${runner.name}. Finished in ${clock.textContent}. Tap to restart.`;
  button.setAttribute("aria-label", label);
}

function recordTap(tile) {
  const { runner } = tile;
  const now = Date.now();
  if (runner.startedAt === null || runner.remaining === 0) {
    runner.startedAt = now;
    runner.finishedAt = null;
    runner.remaining = board.laps;
  } else {
    runner.remaining -= 1;
    if (runner.remaining === 0) runner.finishedAt = Math.max(now, runner.startedAt);
  }
  saveBoard();
  refreshTile(tile, now);
  announcement.textContent = runner.remaining === 0
    ? `${runner.name} finished in ${tile.clock.textContent}.`
    : `${runner.name}. ${runner.remaining === 1 ? "Last lap." : `${lapLabel(runner.remaining)} left.`}`;
}

function makeTile(runner, now) {
  const button = tileTemplate.content.firstElementChild.cloneNode(true);
  const tile = {
    runner,
    button,
    count: button.querySelector(".tile-count"),
    clock: button.querySelector(".tile-time"),
    state: button.querySelector(".tile-state"),
    marks: button.querySelector(".tile-progress"),
    restart: button.querySelector(".restart-hint"),
  };
  button.dataset.color = runner.color;
  button.querySelector(".tile-name").textContent = runner.name;
  tile.marks.classList.toggle("is-segmented", board.laps <= 24);
  tile.marks.style.setProperty("--target-laps", board.laps);
  button.addEventListener("click", () => recordTap(tile));
  refreshTile(tile, now);
  return tile;
}

function showBoard() {
  const now = Date.now();
  closeColorPicker();
  boardLaps.textContent = `${lapLabel(board.laps)} per runner`;
  runnerBoard.dataset.count = board.runners.length;
  tiles = board.runners.map((runner) => makeTile(runner, now));
  runnerBoard.replaceChildren(...tiles.map((tile) => tile.button));
  announcement.textContent = "";
  setupScreen.hidden = true;
  boardScreen.hidden = false;
}

function updateClocks() {
  if (boardScreen.hidden) return;
  const now = Date.now();
  for (const { runner, clock } of tiles) {
    const time = readTime(runner, now);
    if (clock.textContent !== time) clock.textContent = time;
  }
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const activeRunners = draft.slice(0, Number(participantCount.value));
  const invalidName = activeRunners.findIndex((runner) => !runner.name.trim());
  if (invalidName !== -1) {
    const input = roster.querySelectorAll(".runner-name")[invalidName];
    input.setCustomValidity("Enter a name for this runner.");
    input.reportValidity();
    return;
  }
  if (!setupMatchesBoard()) {
    const laps = lapCount.valueAsNumber;
    board = {
      laps,
      runners: activeRunners.map(({ name, color }) => ({
        name: name.trim(), color, remaining: laps, startedAt: null, finishedAt: null,
      })),
    };
    saveBoard();
  }
  showBoard();
  focusScreen(boardTitle);
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
editSetup.addEventListener("click", () => {
  showSetup();
  focusScreen(setupTitle);
});
backToBoard.addEventListener("click", () => {
  showBoard();
  focusScreen(boardTitle);
});
restartApp?.addEventListener("click", () => {
  if (!window.confirm("Restart the app? This clears the roster, lap count, and stopwatch times saved on this device.")) return;
  board = null;
  saveBoard();
  tiles = [];
  runnerBoard.replaceChildren();
  announcement.textContent = "";
  showSetup();
  focusScreen(setupTitle);
});

for (let count = 1; count <= palette.size; count += 1) {
  participantCount.add(new Option(String(count), String(count)));
}
if (board) showBoard();
else showSetup();
window.setInterval(updateClocks, 150);
document.addEventListener("visibilitychange", updateClocks);
