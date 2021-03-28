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
 * Load a JSON file of cities
 * @param {string} path
 * @returns {Promise<City[]>}
 */
async function loadCities(path = './cities.json') {
  const response = await fetch(path);
  return await response.json();
}

const field = document.querySelector('section');
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
  const errorIndexes = errors.filter(({ type }) => type === 'cell').map(({ index }) => index);
  field.querySelectorAll('.city > .cell').forEach((cell, index) => {
    cell.classList.toggle('error', errorIndexes.includes(index));
  });

  gameErrors = errors;
}

async function main() {
  const cities = await loadCities();
  initializeCity(cities[0]);
}

main();
