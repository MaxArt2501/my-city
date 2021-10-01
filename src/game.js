// @ts-check
import { dialogs, resetControls } from './input.js';
import { deserializeState, serializeCity, serializeState } from './serialize.js';
import { setMetadata, updateCityData } from './storage.js';
import { createEmptyState, formatElapsed, getAttemptElapsed, isAttemptSuccessful, renderForList, toISODuration } from './utils.js';

/** @type {number[][]} */
export let buildings;

/** @type {Set<number>[][]} */
export let marks;

/** @type {City} */
export let currentCity;

/** @type {string} */
export let cityId;

/** @type {GameError[]} */
let gameErrors;

export let markMode = false;

/** @type {CityData} */
let cityData;

/**
 * Tells how many moves we're behind in the current history with relation to
 * the last move.
 * Gets reset to 0 every time the history is updated.
 */
let historyPointer = 0;

/** @type {string} */
let currentAttempt;

/** @type {number} */
let attemptStart;

/** @type {number} */
let clockInterval;

/** @type {HTMLElement} */
export const field = document.querySelector('#gameField');
/** @type {HTMLTimeElement} */
const elapsedTime = document.querySelector('#elapsed');

const borderNames = ['top', 'right', 'bottom', 'left'];

/** @type {HTMLTemplateElement} */
const template = document.querySelector('#fieldTemplate');

/** @type {HTMLButtonElement} */
const undoBtn = document.querySelector('[data-action="undo"]');
/** @type {HTMLButtonElement} */
const redoBtn = document.querySelector('[data-action="redo"]');

/**
 * Renders a city
 * @param {City} city
 * @param {CityData} theData
 */
export function initializeCity(city, theData) {
  const { history, attempts } = theData;
  currentAttempt = attempts[attempts.length - 1] || `${new Date().toISOString()} PT0`;

  currentCity = city;
  cityId = serializeCity(city);
  setMetadata(cityId, 'lastCity');

  startClock();

  const lastPlayed = new Date().toISOString();
  cityData = { ...theData, lastPlayed };
  if (history && history.length > 0) {
    ({ buildings, marks } = deserializeState(history[history.length - 1], city.width, city.height));
  } else {
    ({ buildings, marks } = createEmptyState());
    cityData = { ...cityData, attempts: [currentAttempt], history: [serializeState(city, buildings, marks)] };
  }
  saveCurrentCity();
  renderCity(field, city);
  renderState();
  resetControls();
}

export function startClock() {
  if (!currentCity || clockInterval || isAttemptSuccessful(currentAttempt)) {
    return;
  }
  attemptStart = Date.now();
  clockInterval = setInterval(renderTime, 1000);
  renderTime();
}

export function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = void 0;
    if (!isAttemptSuccessful(currentAttempt)) {
      cityData = {
        ...cityData,
        attempts: updateAttempts()
      };
      saveCurrentCity();
    }
  }
}

export function leaveCity() {
  stopClock();
  elapsedTime.textContent = '';
  elapsedTime.dateTime = '';
  currentCity = void 0;
  cityId = void 0;
  buildings = void 0;
  marks = void 0;
  cityData = void 0;
}

function renderTime() {
  const elapsed = getAttemptElapsed(currentAttempt) + Date.now() - attemptStart;
  elapsedTime.textContent = formatElapsed(elapsed);
  elapsedTime.dateTime = toISODuration(elapsed);
}

/**
 * Renders the game field according to the city data
 * @param {HTMLElement} gameField
 * @param {City} city
 */
export function renderCity(gameField, city) {
  const structure = template.content.cloneNode(true);

  city.borderHints.forEach((hints, index) => {
    /** @type {HTMLDivElement} */
    const wrapper = structure.querySelector(`.${borderNames[index]}.hints`);
    renderForList(hints, wrapper.children, createCell.bind(null, wrapper), (cell, hint) => (cell.firstChild.textContent = hint || ''));
  });

  renderForList(Array(city.width * city.height).fill(0), [], createCell.bind(null, structure.querySelector('.city')), () => {});

  const maxValue = Math.max(city.width, city.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));
  const markRows = Math.ceil(maxValue / markColumns);
  gameField.style.setProperty('--city-width', String(city.width));
  gameField.style.setProperty('--city-height', String(city.height));
  gameField.style.setProperty('--mark-grid-cols', String(markColumns));
  gameField.style.setProperty('--mark-grid-rows', String(markRows));

  gameField.textContent = '';
  gameField.appendChild(structure);
}

function renderState() {
  const maxValue = Math.max(currentCity.width, currentCity.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));
  /** @type {HTMLDivElement} */
  const cityWrapper = field.querySelector('.city');

  renderForList(buildings.flat(), cityWrapper.children, createCell.bind(null, cityWrapper), (cell, value, index) => {
    cell.firstChild.textContent = value || '';
    cell.dataset.buildingHeight = String(value || 0);

    const column = index % currentCity.width;
    const row = (index - column) / currentCity.height;
    const cellMarks = Array.from(marks[row][column]);
    const label = `Row ${row}, column ${column}: ${value || (cellMarks.length ? `annotated with ${cellMarks.join(', ')}` : 'empty')}`;
    cell.setAttribute('aria-label', label);

    renderForList(
      cellMarks,
      cell.querySelectorAll('.mark'),
      () => cell.appendChild(Object.assign(document.createElement('span'), { className: 'mark' })),
      (wrapper, mark) => {
        wrapper.dataset.value = mark;
        wrapper.style.gridArea = `${Math.floor((mark - 1) / markColumns) + 1} / ${((mark - 1) % markColumns) + 1}`;
      }
    );
  });

  /** @type {HTMLElement} */
  const selectorWrapper = document.querySelector('.selectors');
  renderForList(
    Array.from({ length: maxValue }, (_, index) => index + 1),
    selectorWrapper.children,
    () => selectorWrapper.appendChild(Object.assign(document.createElement('button'), { type: 'button' })),
    (button, value) => {
      button.textContent = value;
      button.setAttribute('aria-label', `Set the current value to ${value}`);
    }
  );

  checkForErrors();
  undoBtn.disabled = historyPointer >= cityData.history.length - 1;
  redoBtn.disabled = historyPointer === 0;
}

/**
 * Creates a cell element and appends it to the given parent
 * @param {HTMLDivElement} parent
 * @returns {HTMLDivElement}
 */
function createCell(parent) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = '<span class="value"></span>';
  return parent.appendChild(cell);
}

export function restartGame() {
  stopClock();

  currentAttempt = `${new Date().toISOString()} PT0`;
  cityData = {
    ...cityData,
    attempts: updateAttempts(),
    history: []
  };
  saveCurrentCity();
  ({ buildings, marks } = createEmptyState());

  updateHistory();
  renderState();
  startClock();
}

/**
 * Should create an element for an item of data, and attach it to the DOM tree
 * @param {number} row
 * @param {number} column
 * @param {number} value
 */
export function updateCellValue(row, column, value) {
  if (isAttemptSuccessful(currentAttempt)) {
    // A successful attempt can't be updated - only navigated through its
    // history or restarted
    return;
  }
  if (markMode) {
    const hasMark = marks[row][column].has(value);
    if (hasMark) {
      marks[row][column].delete(value);
    } else if (!hasMark && value) {
      marks[row][column].add(value);
    }
  } else {
    buildings[row][column] = buildings[row][column] === value ? 0 : value;
  }
  updateHistory();
  renderState();
}

/**
 * Sets or toggles the current game mode
 * @param {boolean} [forceMarkMode]
 */
export function toggleMode(forceMarkMode) {
  markMode = typeof forceMarkMode === 'undefined' ? !markMode : !!forceMarkMode;
  updateStatus();
}

/**
 * Computes the errors in the field and eventually renders them
 */
async function checkForErrors() {
  const fieldErrors = await requestSolver('getFieldErrors', { buildings });
  fillErrors('.city > .cell', fieldErrors);

  const borderErrors = await requestSolver('getBorderErrors', { buildings, borderHints: currentCity.borderHints });
  fillErrors('.hints > .cell', borderErrors);

  gameErrors = [...fieldErrors, ...borderErrors];
  updateStatus();
}

/**
 * @param {string} selector CSS selector of the cells
 * @param {GameError[]} errors Errors to be applied to the cells
 */
function fillErrors(selector, errors) {
  /** @type {NodeListOf<HTMLSpanElement>} */
  const cells = field.querySelectorAll(selector);
  cells.forEach((cell, index) => {
    const cellErrors = errors.filter(error => error.index === index);
    cell.dataset.errors = JSON.stringify(cellErrors);
    cell.classList.toggle('error', cellErrors.length > 0);
    renderForList(
      cellErrors.length > 0 ? [cellErrors] : [],
      cell.querySelectorAll('.errors'),
      () => {
        const errorWrapper = document.createElement('div');
        errorWrapper.setAttribute('role', 'tooltip');
        errorWrapper.className = 'errors';
        errorWrapper.innerHTML = '<ul></ul>';
        return cell.appendChild(errorWrapper);
      },
      (errorWrapper, errors) => {
        renderForList(
          errors,
          errorWrapper.querySelectorAll('li'),
          () => errorWrapper.appendChild(document.createElement('li')),
          (item, error) => (item.textContent = error)
        );
      }
    );
  });
}

const toggleModeBtn = document.querySelector('[data-action="toggleGameMode"]');
const toolbar = document.querySelector('aside[role="toolbar"]');
function updateStatus() {
  const isComplete = isCityComplete();
  if (isComplete) {
    stopClock();
    field.dataset.completionTime = formatElapsed(getAttemptElapsed(currentAttempt));
  } else {
    delete field.dataset.completionTime;
  }
  document.body.dataset.gameMode = markMode ? 'mark' : 'enter';
  toggleModeBtn.setAttribute('aria-label', `Switch to ${markMode ? 'enter' : 'annotation'} mode`);
  toolbar.setAttribute('aria-hidden', String(isComplete));
  toolbar.querySelectorAll('button').forEach(button => (button.disabled = isComplete));

  setTimeout(() => {
    field.classList.toggle('complete', isComplete);
  });
}

export function isCityComplete() {
  const hasGaps = buildings.flat().includes(0);
  return !hasGaps && !gameErrors.length;
}

function updateHistory() {
  const state = serializeState(currentCity, buildings, marks);
  const { history } = cityData;
  const lastState = cityData[history.length - 1];
  if (state !== lastState) {
    cityData = {
      ...cityData,
      history: [...history.slice(0, history.length - historyPointer), state],
      attempts: updateAttempts()
    };
    saveCurrentCity();
    historyPointer = 0;
  }
}

function updateAttempts() {
  const [timestamp] = currentAttempt.split(' ', 1);
  const now = Date.now();
  const elapsed = getAttemptElapsed(currentAttempt) + now - attemptStart;
  attemptStart = now;
  currentAttempt = `${timestamp} ${toISODuration(elapsed)}${isCityComplete() ? '*' : ''}`;
  const attemptIndex = cityData.attempts.findIndex(attempt => attempt.startsWith(timestamp));
  if (attemptIndex >= 0) {
    return [...cityData.attempts.slice(0, attemptIndex), currentAttempt, ...cityData.attempts.slice(attemptIndex + 1)];
  }
  return [...cityData.attempts, currentAttempt];
}

function saveCurrentCity() {
  updateCityData(cityId, cityData);
}

/**
 * Travels the current history, if possible. Pass -1 for undo the last move
 * @param {number} shift
 */
export function travelHistory(shift) {
  const { history } = cityData;
  historyPointer = Math.max(0, Math.min(historyPointer + shift, history.length - 1));
  ({ buildings, marks } = deserializeState(history[history.length - historyPointer - 1], currentCity.width, currentCity.height));
  renderState();
}

/**
 * Fills the empty cells with annotations for all the admissible height values
 */
export async function fillMarks() {
  marks = await requestSolver('getAllowedHeights', { buildings, borderHints: currentCity.borderHints });
  updateHistory();
  renderState();
}

/** @type {Worker} */
const solverWorker = new Worker('./solver.js');
solverWorker.addEventListener('message', event => {
  const { token, result, error } = event.data;
  const promiseSettlers = solverRequests.get(token);
  if (promiseSettlers) {
    if (error) {
      promiseSettlers.reject(error);
    } else {
      promiseSettlers.resolve(result);
    }
    solverRequests.delete(token);
  }
});

function getSolver() {
  return solverWorker;
}

/** @type {Map.<number, { resolve(value: unknown): void; reject(value: unknown): void; }>} */
const solverRequests = new Map();
let solverRequestCount = 0;

/**
 * Makes a request to the solver
 * @param {SolverRequestType} request
 * @param {object} params
 * @returns {Promise}
 */
export function requestSolver(request, params) {
  const token = solverRequestCount++;
  const promise = new Promise((resolve, reject) => {
    solverRequests.set(token, { resolve, reject });
  });
  solverWorker.postMessage({ request, token, ...params });
  return promise;
}

export async function placeHint() {
  /** @type {[number, number, number]} */
  const hint = await requestSolver('hint', { borderHints: currentCity.borderHints, buildings });
  if (hint) {
    updateCellValue(...hint);
  } else {
    stopClock();
    dialogs.noIdea.showModal();
  }
}
