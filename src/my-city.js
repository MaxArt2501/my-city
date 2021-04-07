/**
 * @typedef {object} City
 * @property {number} width
 * @property {number} height
 * @property {number[][]} borderHints
 */
/**
 * @typedef {object} GameError
 * @property {string} type
 * @property {string} message
 * @property {number} index
 */
/**
 * @typedef {object} StairsRanges
 * @property {number[]} start
 * @property {number[]} end
 */
/**
 * @typedef {object} State
 * @property {number[][]} buildings
 * @property {Set<number>[][]} marks
 */

/**
 * Load a JSON file of cities
 * @param {string} path
 * @returns {Promise<City[]>}
 */
async function loadCities(path = './cities.json') {
  const response = await fetch(path);
  return await response.json();
}

const field = document.querySelector('section');
const output = document.querySelector('p');
const borderNames = ['top', 'right', 'bottom', 'left'];
const borderWrappers = borderNames.map(name => field.querySelector(`.${name}.hints`));
const cityWrapper = field.querySelector('.city');

field.addEventListener('click', ({ target }) => {
  const valueContainer = target.closest('.city .value');
  if (valueContainer) {
    handleClick(valueContainer);
  }
});
document.addEventListener('keypress', event => {
  if (event.key.toLowerCase() === 'm') {
    markMode = !markMode;
    updateStatus();
  }
});

/** @type {number[][]} */
let buildings;

/** @type {Set<number>[][]} */
let marks;

/** @type {City} */
let currentCity;

/** @type {GameError[]} */
let gameErrors;

let markMode = false;

/** @type {string[]} */
let history;

/**
 * Renders a city
 * @param {City} cityData
 */
function initializeCity(cityData) {
  currentCity = cityData;
  localStorage['.lastCity'] = btoa(serializeCity());

  const maxValue = Math.max(cityData.width, cityData.height);
  const markColumns = Math.ceil(Math.sqrt(maxValue));
  const markRows = Math.ceil((maxValue) / markColumns);
  field.style.setProperty('--mark-grid-cols', markColumns);
  field.style.setProperty('--mark-grid-rows', markRows);

  cityWrapper.style.setProperty('--city-width', cityData.width);
  cityWrapper.style.setProperty('--city-height', cityData.height);

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
        wrapper.style.gridArea = `${Math.floor((mark - 1) / markColumns) + 1} / ${(mark - 1) % markColumns + 1}`;
      }
    );
  });

  checkForErrors();
}

/**
 * Should create an element for an item of data, and attach it to the DOM tree
 * @callback ElementFactory
 * @param {number} index
 * @returns {HTMLElement}
 */
/**
 * @callback ElementUpdater
 * @param {HTMLElement} element
 * @param {*} dataItem
 * @param {number} index
 */

/**
 * Renders a data array, creating new elements when needed and removing
 * @param {Array} dataList
 * @param {ArrayLike<HTMLElement>} existingElements
 * @param {ElementFactory} elementFactory
 * @param {ElementUpdater} elementUpdater
 */
function renderForList(dataList, existingElements, elementFactory, elementUpdater) {
  dataList.forEach((dataItem, index) => {
    const element = index >= existingElements.length ? elementFactory(index) : existingElements[index];
    elementUpdater(element, dataItem, index);
  });
  for (let index = existingElements.length - 1; index >= dataList; index--) {
    existingElements[index].remove();
  }
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
 * Handles the click on a building cell
 * @param {HTMLDivElement} valueContainer
 */
function handleClick(valueContainer) {
  const editableContainer = field.querySelector('.value[contenteditable=true]');
  if (editableContainer && valueContainer !== editableContainer) {
    editableContainer.contentEditable = false;
  }
  valueContainer.contentEditable = true;
  valueContainer.focus();
  valueContainer.addEventListener('keydown', handleInput);
  valueContainer.addEventListener(
    'blur',
    () => {
      valueContainer.contentEditable = false;
      valueContainer.removeEventListener('keydown', handleInput);
    },
    { once: true }
  );
}

/**
 * @param {KeyboardEvent} event
 */
function handleInput(event) {
  /** @type {HTMLDivElement} */
  const valueContainer = event.target;
  if (isFinite(event.key) && event.key !== '0' && +event.key <= Math.max(currentCity.width, currentCity.height)) {
    updateCellValue(valueContainer, +event.key);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    updateCellValue(valueContainer, 0);
  } else if (event.key === 'Escape' || event.key === 'Enter') {
    valueContainer.blur();
  } else {
    event.preventDefault();
  }
}

/**
 * Updates the value of a cell
 * @param {HTMLSpanElement} valueContainer
 * @param {number} value
 */
function updateCellValue(valueContainer, value) {
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
  valueContainer.blur();
  renderState();
  updateHistory();
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
  field.querySelectorAll(selector).forEach((cell, index) => {
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
  const state = btoa(serializeState());
  const lastState = history[history.length - 1];
  if (state !== lastState) {
    history.push(state);
    localStorage.setItem(btoa(serializeCity()), JSON.stringify(history));
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

function serializeCity() {
  const cityData = new Uint8Array(1 + currentCity.width + currentCity.height);
  cityData[0] = currentCity.width + (currentCity.height << 4);

  currentCity.borderHints[0].forEach((topHint, index) => {
    const bottomHint = currentCity.borderHints[2][currentCity.width - index - 1];
    cityData[index + 1] = topHint + (bottomHint << 4);
  });

  currentCity.borderHints[1].forEach((rightHint, index) => {
    const leftHint = currentCity.borderHints[3][currentCity.height - index - 1];
    cityData[index + 1 + currentCity.width] = leftHint + (rightHint << 4);
  });

  return new TextDecoder().decode(cityData.buffer);
}

/**
 * Deserializes a serialized city
 * @param {string} serialized
 * @returns {City}
 */
function deserializeCity(serialized) {
  const cityData = new TextEncoder().encode(serialized);
  const width = cityData[0] & 15;
  const height = cityData[0] >> 4;

  /** @type {City} */
  const city = {
    width,
    height,
    borderHints: [new Array(width), new Array(height), new Array(width), new Array(height)]
  };
  for (let index = 0; index < city.width; index++) {
    const topHint = cityData[index + 1] & 15;
    const bottomHint = cityData[index + 1] >> 4;
    city.borderHints[0][index] = topHint;
    city.borderHints[2][city.width - index - 1] = bottomHint;
  }
  for (let index = 0; index < city.height; index++) {
    const leftHint = cityData[index + city.width + 1] & 15;
    const rightHint = cityData[index + city.width + 1] >> 4;
    city.borderHints[1][index] = rightHint;
    city.borderHints[3][city.height - index - 1] = leftHint;
  }
  return city;
}
window.deserializeCity = deserializeCity;

/**
 * Returns a string representing the current state
 * @returns {string}
 */
function serializeState() {
  const citySize = currentCity.width * currentCity.height;
  const cityState = new Uint8Array(Math.ceil(citySize * 2.5));

  /** @type {number[]} */
  const allCells = buildings.flat();
  allCells.forEach((value, index) =>{
    const cityIndex = index >> 1;
    cityState[cityIndex] = cityState[cityIndex] + (value << (index & 1 ? 4 : 0));
  });

  const marksData = new Uint16Array(citySize);
  /** @type {Set<number>[]} */
  const allMarks = marks.flat();
  allMarks.forEach((cellMarks, index) => {
    for (const mark of cellMarks) {
      marksData[index] = marksData[index] ^ (1 << (mark - 1));
    }
  });

  cityState.set(new Uint8Array(marksData.buffer), Math.ceil(citySize / 2));
  return new TextDecoder().decode(cityState.buffer);
}

/**
 * Returns a deserialized structured game state
 * @param {string} serialized
 * @param {number} width
 * @param {number} height
 * @returns {State}
 */
function deserializeState(serialized, width, height) {
  const stateData = new TextEncoder().encode(serialized);
  const citySize = width * height;
  const values = Array.from({ length: citySize }, (_, index) => {
    const byte = stateData[index >> 1];
    return index & 1 ? byte >> 4 : byte & 15;
  });

  const markOffset = Math.ceil(citySize / 2);
  const maxValue = Math.max(width, height);
  const markData = new Uint16Array(stateData.buffer.slice(markOffset));
  /** @type {State} */
  const state = {
    buildings: Array.from({ length: height }, (_, index) => values.slice(index * width, (index + 1) * width)),
    marks: Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, column) => {
      /** @type {Set<number>} */
      const cellMarks = new Set();
      const index = row * width + column;
      const markByte = markData[index];
      for (let value = 1; value <= maxValue; value++) {
        if (markByte & (1 << (value - 1))) {
          cellMarks.add(value);
        }
      }
      return cellMarks;
    }))
  };
  return state;
}
window.deserializeState = deserializeState;

async function main() {
  const lastCityId = localStorage['.lastCity'];
  if (lastCityId) {
    const city = deserializeCity(atob(lastCityId));
    history = localStorage[lastCityId] ? JSON.parse(localStorage[lastCityId]) : [];
    initializeCity(city);
  } else {
    const cities = await loadCities();
    initializeCity(cities[0]);
  }
}

main();