// @ts-check
import { deserializeState, serializeCity, serializeState } from './serialize.js';

/** @type {number[][]} */
export let buildings;

/** @type {Set<number>[][]} */
export let marks;

/** @type {City} */
export let currentCity;

/** @type {GameError[]} */
export let gameErrors;

export let markMode = false;

/** @type {string[]} */
export let history;

export const field = document.querySelector('section');

/** @type {HTMLDivElement} */
const cityWrapper = field.querySelector('.city');
const output = document.querySelector('p');
const borderNames = ['top', 'right', 'bottom', 'left'];
/** @type {HTMLElement[]} */
const borderWrappers = borderNames.map(name => field.querySelector(`.${name}.hints`));

/**
 * Renders a city
 * @param {City} cityData
 * @param {string[]} cityHistory
 */
export function initializeCity(cityData, cityHistory) {
  currentCity = cityData;
  localStorage['.lastCity'] = btoa(serializeCity(cityData));

  const maxValue = Math.max(cityData.width, cityData.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));
  const markRows = Math.ceil(maxValue / markColumns);
  field.style.setProperty('--mark-grid-cols', String(markColumns));
  field.style.setProperty('--mark-grid-rows', String(markRows));

  cityWrapper.style.setProperty('--city-width', String(cityData.width));
  cityWrapper.style.setProperty('--city-height', String(cityData.height));

  history = cityHistory;
  if (history && history.length > 0) {
    ({ buildings, marks } = deserializeState(atob(history[history.length - 1]), cityData.width, cityData.height));
  } else {
    ({ buildings, marks } = createEmptyState());
    history = [];
    updateHistory();
  }
  renderState();
}

function renderState() {
  const maxValue = Math.max(currentCity.width, currentCity.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));

  currentCity.borderHints.forEach((hints, index) => {
    const wrapper = borderWrappers[index];
    renderForList(hints, wrapper.children, createCell.bind(null, wrapper), (cell, hint) => (cell.firstChild.textContent = hint || ''));
  });

  renderForList(buildings.flat(), cityWrapper.children, createCell.bind(null, cityWrapper), (cell, value, index) => {
    cell.firstChild.textContent = value || '';

    const column = index % currentCity.width;
    const row = (index - column) / currentCity.height;
    renderForList(
      Array.from(marks[row][column]),
      cell.querySelectorAll('.mark'),
      () => {
        const wrapper = document.createElement('span');
        wrapper.className = 'mark';
        return cell.appendChild(wrapper);
      },
      (wrapper, mark) => {
        wrapper.dataset.value = mark;
        wrapper.style.gridArea = `${Math.floor((mark - 1) / markColumns) + 1} / ${((mark - 1) % markColumns) + 1}`;
      }
    );
  });

  checkForErrors();
}

/**
 * Renders a data array, creating new elements when needed and removing
 * @type {ListRenderer}
 */
function renderForList(dataList, existingElements, elementFactory, elementUpdater) {
  dataList.forEach((dataItem, index) => {
    const element = index >= existingElements.length ? elementFactory(index) : existingElements[index];
    elementUpdater(element, dataItem, index);
  });
  for (let index = existingElements.length - 1; index >= dataList.length; index--) {
    existingElements[index].remove();
  }
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
 * Returns and empty state for the current city
 * @returns {State}
 */
function createEmptyState() {
  return {
    buildings: Array.from({ length: currentCity.height }, () => Array(currentCity.width).fill(0)),
    marks: Array.from({ length: currentCity.height }, () => Array.from({ length: currentCity.width }, () => new Set()))
  };
}

/**
 * Should create an element for an item of data, and attach it to the DOM tree
 * @param {HTMLSpanElement} valueContainer
 * @param {number} value
 */
export function updateCellValue(valueContainer, value) {
  const building = valueContainer.parentElement;
  const cellIndex = Array.from(building.parentElement.children).indexOf(building);
  const column = cellIndex % currentCity.width;
  const row = Math.floor(cellIndex / currentCity.width);
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
  renderState();
  updateHistory();
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
  output.textContent = isComplete ? 'Completed!' : markMode ? 'Mark mode' : 'Enter mode';
}

function updateHistory() {
  const state = btoa(serializeState(currentCity, buildings, marks));
  const lastState = history[history.length - 1];
  if (state !== lastState) {
    history.push(state);
    localStorage.setItem(btoa(serializeCity(currentCity)), JSON.stringify(history));
  }
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

/**
 * @param {number[]} sequence
 * @returns {StairsRanges}
 */
function getStairsRanges(sequence) {
  const availableHeights = Array.from({ length: sequence.length }, (_, index) => index + 1).filter(height => !sequence.includes(height));
  if (availableHeights.length > 0) {
    const ascendingFilled = fillSequence(sequence, availableHeights);
    const maxStart = getStairsLength(ascendingFilled);
    const minEnd = getStairsLength(ascendingFilled.slice().reverse());
    const descendingFilled = fillSequence(sequence, availableHeights.slice().reverse());
    const maxEnd = getStairsLength(descendingFilled.slice().reverse());
    const minStart = getStairsLength(descendingFilled);
    return {
      start: [minStart, maxStart],
      end: [minEnd, maxEnd]
    };
  }
  const startLength = getStairsLength(sequence);
  const endLength = getStairsLength(sequence.slice().reverse());
  return {
    start: [startLength, startLength],
    end: [endLength, endLength]
  };
}

/**
 * @param {number[]} sequence
 * @returns {number}
 */
function getStairsLength(sequence) {
  let count = 0;
  let previous = 0;
  for (const height of sequence) {
    if (height > previous) {
      previous = height;
      count++;
    }
  }
  return count;
}

/**
 * Replaces the 0s in the sequence with the filler numbers given as the second
 * parameter.
 * @param {number[]} sequence
 * @param {number[]} fillers
 * @returns {number[]}
 */
function fillSequence(sequence, fillers) {
  let fillerIndex = 0;
  return sequence.map(height => height || fillers[fillerIndex++]);
}
