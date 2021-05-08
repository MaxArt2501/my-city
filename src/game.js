// @ts-check
import { buttons } from './my-city.js';
import { deserializeState, serializeCity, serializeState } from './serialize.js';
import {
  createEmptyState,
  getAttemptElapsed,
  getCoordinates,
  getStairsRanges,
  isAttemptSuccessful,
  renderForList,
  toISODuration
} from './utils.js';

/** @type {number[][]} */
export let buildings;

/** @type {Set<number>[][]} */
export let marks;

/** @type {City} */
export let currentCity;

/** @type {GameError[]} */
export let gameErrors;

export let markMode = false;

/** @type {CityHistory} */
let cityHistory;

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

export const field = document.querySelector('section');

/** @type {HTMLDivElement} */
const output = document.querySelector('p');
const borderNames = ['top', 'right', 'bottom', 'left'];

/** @type {HTMLTemplateElement} */
const template = document.querySelector('#fieldTemplate');

/**
 * Renders a city
 * @param {City} cityData
 * @param {CityHistory} theHistory
 * @param {string} [attempt]
 */
export function initializeCity(cityData, theHistory, attempt) {
  currentAttempt = attempt || `${new Date().toISOString()} PT0`;
  attemptStart = Date.now();

  currentCity = cityData;
  localStorage['.lastCity'] = serializeCity(cityData);

  cityHistory = theHistory;
  const { history } = theHistory;
  if (history && history.length > 0) {
    ({ buildings, marks } = deserializeState(history[history.length - 1], cityData.width, cityData.height));
  } else {
    ({ buildings, marks } = createEmptyState());
    cityHistory = { history: [], attempts: [currentAttempt] };
    updateHistory();
  }
  renderCity(field, cityData);
  renderState();
}

/**
 * Renders the game field according to the city data
 * @param {HTMLElement} gameField
 * @param {City} cityData
 */
export function renderCity(gameField, cityData) {
  const structure = template.content.cloneNode(true);

  cityData.borderHints.forEach((hints, index) => {
    /** @type {HTMLDivElement} */
    const wrapper = structure.querySelector(`.${borderNames[index]}.hints`);
    renderForList(hints, wrapper.children, createCell.bind(null, wrapper), (cell, hint) => (cell.firstChild.textContent = hint || ''));
  });

  /** @type {HTMLDivElement} */
  const cityWrapper = structure.querySelector('.city');
  cityWrapper.style.setProperty('--city-width', String(cityData.width));
  cityWrapper.style.setProperty('--city-height', String(cityData.height));

  renderForList(Array(cityData.width * cityData.height).fill(0), [], createCell.bind(null, cityWrapper), () => {});

  const maxValue = Math.max(cityData.width, cityData.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));
  const markRows = Math.ceil(maxValue / markColumns);
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

    const column = index % currentCity.width;
    const row = (index - column) / currentCity.height;
    renderForList(
      Array.from(marks[row][column]),
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
    (button, value) => (button.textContent = value)
  );

  checkForErrors();
  buttons.undo.disabled = historyPointer >= cityHistory.history.length - 1;
  buttons.redo.disabled = historyPointer === 0;
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

/**
 * Should create an element for an item of data, and attach it to the DOM tree
 * @param {HTMLSpanElement} valueContainer
 * @param {number} value
 */
export function updateCellValue(valueContainer, value) {
  if (isAttemptSuccessful(currentAttempt)) {
    // A successful attempt can't be updated - only navigated through its
    // history or restarted
    return;
  }
  const [row, column] = getCoordinates(valueContainer.parentElement);
  if (markMode && value) {
    const hasMark = marks[row][column].has(value);
    if (hasMark) {
      marks[row][column].delete(value);
    } else if (!hasMark && value) {
      marks[row][column].add(value);
    }
  } else if (!markMode) {
    buildings[row][column] = value;
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
function checkForErrors() {
  const fieldErrors = getFieldErrors();
  fillErrors('.city > .cell', fieldErrors);

  const borderErrors = getBorderErrors();
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

function updateStatus() {
  const hasGaps = buildings.flat().includes(0);
  const isComplete = !hasGaps && !gameErrors.length;
  output.textContent = isComplete ? 'Completed!' : '';
  document.body.dataset.gameMode = markMode ? 'mark' : 'enter';
}

function updateHistory() {
  const state = serializeState(currentCity, buildings, marks);
  const { history } = cityHistory;
  const lastState = cityHistory[history.length - 1];
  if (state !== lastState) {
    cityHistory = {
      history: [...history.slice(0, history.length - historyPointer), state],
      attempts: updateAttempts()
    };
    localStorage.setItem(serializeCity(currentCity), JSON.stringify(cityHistory));
    historyPointer = 0;
  }
}

function updateAttempts() {
  const [timestamp] = currentAttempt.split(' ', 1);
  const attemptIndex = cityHistory.attempts.findIndex(attempt => attempt.startsWith(timestamp));
  if (attemptIndex >= 0) {
    const elapsed = getAttemptElapsed(cityHistory.attempts[attemptIndex]) + Date.now() - attemptStart;
    return [
      ...cityHistory.attempts.slice(0, attemptIndex),
      `${timestamp} ${toISODuration(elapsed)}`,
      ...cityHistory.attempts.slice(attemptIndex + 1)
    ];
  }
  return [...cityHistory.attempts, currentAttempt];
}

/**
 * Travels the current history, if possible. Pass -1 for undo the last move
 * @param {number} shift
 */
export function travelHistory(shift) {
  const { history } = cityHistory;
  historyPointer = Math.max(0, Math.min(historyPointer + shift, history.length - 1));
  ({ buildings, marks } = deserializeState(history[history.length - historyPointer - 1], currentCity.width, currentCity.height));
  renderState();
}

/**
 * Returns errors for duplicate building heights in rows and columns
 * @returns {GameError[]}
 */
function getFieldErrors() {
  /** @type {GameError[]} */
  const errors = [];
  buildings.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return;
      }
      const cellIndex = rowIndex * currentCity.width + colIndex;
      buildings.forEach((checkRow, checkRowIndex) => {
        const checkCell = checkRow[colIndex];
        if (cell === checkCell && rowIndex !== checkRowIndex) {
          errors.push({
            type: 'cell',
            message: `There is another "${cell}" in this column`,
            index: cellIndex
          });
        }
      });
      if (row.indexOf(cell) !== colIndex || row.lastIndexOf(cell) !== colIndex) {
        errors.push({
          type: 'cell',
          message: `There is another "${cell}" in this row`,
          index: cellIndex
        });
      }
    });
  });
  return errors;
}

/**
 * Returns errors for unsatisfied border hints
 * @returns {GameError[]}
 */
function getBorderErrors() {
  /** @type {GameError[]} */
  const errors = [];
  for (let index = 0; index < currentCity.height; index++) {
    const startHint = currentCity.borderHints[3][currentCity.height - index - 1];
    const endHint = currentCity.borderHints[1][index];
    if (!startHint && !endHint) {
      continue;
    }

    const row = buildings[index];
    const ranges = getStairsRanges(row);
    if ((startHint && startHint < ranges.start[0]) || startHint > ranges.start[1]) {
      errors.push({
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index: 2 * (currentCity.width + currentCity.height) - index - 1
      });
    }
    if ((endHint && endHint < ranges.end[0]) || endHint > ranges.end[1]) {
      errors.push({
        type: 'border',
        message: `The constraint "${endHint}" cannot be satisfied`,
        index: currentCity.width + index
      });
    }
  }
  for (let index = 0; index < currentCity.width; index++) {
    const startHint = currentCity.borderHints[0][index];
    const endHint = currentCity.borderHints[2][currentCity.width - index - 1];
    if (!startHint && !endHint) {
      continue;
    }

    const column = buildings.map(row => row[index]);
    const ranges = getStairsRanges(column);
    if (startHint && (startHint < ranges.start[0] || startHint > ranges.start[1])) {
      errors.push({
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index
      });
    }
    if (endHint && (endHint < ranges.end[0] || endHint > ranges.end[1])) {
      errors.push({
        type: 'border',
        message: `The constraint "${endHint}" cannot be satisfied`,
        index: 2 * currentCity.width + currentCity.height - index - 1
      });
    }
  }
  return errors;
}
