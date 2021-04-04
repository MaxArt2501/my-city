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

field.addEventListener('click', ({ target }) => {
  const building = target.closest('.city > .cell');
  if (building) {
    handleClick(building);
  }
});

/** @type {number[][]} */
let buildings;

/** @type {number[][][]} */
let marks;

/** @type {City} */
let currentCity;

/** @type {GameError[]} */
let gameErrors;

/**
 * Renders a city
 * @param {City} cityData
 */
function initializeCity(cityData) {
  currentCity = cityData;
  field.innerHTML = '';
  Array.from({ length: 4 }, (_, index) => cityData.borderHints[index]).forEach((hints, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `${borderNames[index]} hints`;

    for (const hint of hints) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = hint || '';
      wrapper.appendChild(cell);
    }

    field.appendChild(wrapper);
  });

  const city = document.createElement('div');
  city.className = 'city';
  city.style.setProperty('--city-width', cityData.width);
  city.style.setProperty('--city-height', cityData.height);

  buildings = Array.from({ length: cityData.height }, () => Array(cityData.width).fill(0));
  marks = [];
  for (const row of buildings) {
    const marksRow = [];
    for (const _ of row) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      city.appendChild(cell);
      marksRow.push([]);
    }
    marks.push(marksRow);
  }
  field.appendChild(city);
}

/**
 * Handles the click on a building cell
 * @param {HTMLDivElement} building
 */
function handleClick(building) {
  for (const cell of building.parentElement.children) {
    cell.contentEditable = cell === building;
  }
  building.focus();
  building.addEventListener('keydown', handleInput);
  building.addEventListener(
    'blur',
    () => {
      building.contentEditable = false;
      building.removeEventListener('keydown', handleInput);
    },
    { once: true }
  );
}

/**
 * @param {KeyboardEvent} event
 */
function handleInput(event) {
  /** @type {HTMLDivElement} */
  const building = event.target;
  const cellIndex = Array.from(building.parentElement.children).indexOf(building);
  const column = cellIndex % currentCity.width;
  const row = Math.floor(cellIndex / currentCity.width);
  if (isFinite(event.key) && event.key !== '0' && +event.key <= Math.max(currentCity.width, currentCity.height)) {
    building.textContent = event.key;
    buildings[row][column] = +event.key;
    building.blur();
    checkForErrors();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    building.textContent = '';
    buildings[row][column] = 0;
    building.blur();
    checkForErrors();
  } else if (event.key === 'Escape' || event.key === 'Enter') {
    building.blur();
  } else {
    event.preventDefault();
  }
}

function checkForErrors() {
  const fieldErrors = getFieldErrors();
  fillErrors('.city > .cell', fieldErrors);

  const borderErrors = getBorderErrors();
  fillErrors('.hints > .cell', borderErrors);

  gameErrors = [...fieldErrors, ...borderErrors];
  checkForCompletion();
}

/**
 * @param {string} selector CSS selector of the cells
 * @param {GameError[]} errors Errors to be applied to the cells
 */
function fillErrors(selector, errors) {
  field.querySelectorAll(selector).forEach((cell, index) => {
    const cellErrors = errors.filter(error => error.index === index);
    cell.classList.toggle('error', cellErrors.length > 0);
    cell.dataset.errors = JSON.stringify(cellErrors);
    if (cellErrors.length > 0) {
      const errorWrapper = document.createElement('div');
      errorWrapper.setAttribute('role', 'tooltip');
      errorWrapper.className = 'errors';
      if (cellErrors.length > 1) {
        const list = document.createElement('ul');
        for (const error of cellErrors) {
          const item = document.createElement('li');
          item.textContent = error.message;
          list.appendChild(item);
        }
        errorWrapper.appendChild(list);
      } else {
        errorWrapper.textContent = cellErrors[0].message;
      }
      cell.appendChild(errorWrapper);
    } else {
      cell.querySelector('.errors')?.remove();
    }
  });
}

function checkForCompletion() {
  const hasGaps = buildings.flat().includes(0);
  const isComplete = !hasGaps && !gameErrors.length;
  output.textContent = isComplete ? 'Completed!' : '';
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

function showErrorsTooltip() {}

async function main() {
  const cities = await loadCities();
  initializeCity(cities[0]);
}

main();
