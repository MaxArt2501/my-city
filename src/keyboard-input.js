// @ts-check
import { buildings, currentCity, field, markMode, updateCellValue } from './game.js';
import { shiftValue } from './utils.js';

/** @type {number} */
let cursorRow;
/** @type {number} */
let cursorColumn;

/** @type {InputMode} */
export const mode = 'keyboard';

export function initialize() {
  if (typeof cursorRow === 'undefined') {
    setPosition(0, 0);
  }
  document.addEventListener('keydown', handleKeyDown);
}

export function terminate() {
  document.removeEventListener('keydown', handleKeyDown);
}

const arrows = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

/** @type {ArrowGuard} */
const isDirectionArrow = key => arrows.includes(key);

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown({ key }) {
  if (isDirectionArrow(key)) {
    const keyIndex = arrows.indexOf(key);
    const rowShift = (keyIndex & 1) === 0 ? keyIndex - 1 : 0;
    const columnShift = (keyIndex & 1) === 0 ? 0 : 2 - keyIndex;
    setPosition(shiftValue(cursorRow, rowShift, currentCity.height), shiftValue(cursorColumn, columnShift, currentCity.width));
  } else if (isFinite(+key) && key !== '0' && +key <= Math.max(currentCity.width, currentCity.height)) {
    const value = markMode || buildings[cursorRow][cursorColumn] !== +key ? +key : 0;
    updateCellValue(getValueContainer(), value);
  }
}

/**
 *
 * @param {number} row
 * @param {number} column
 */
function setPosition(row, column) {
  cursorRow = row;
  cursorColumn = column;
  field.querySelector('.value[aria-current="true"]')?.setAttribute('aria-current', 'false');
  getValueContainer()?.setAttribute('aria-current', 'true');
}

/**
 * Returns the value container of the call of the cursor's coordinates
 * @returns {HTMLSpanElement}
 */
function getValueContainer() {
  const cellIndex = cursorRow * currentCity.width + cursorColumn;
  return field.querySelector(`.city .cell:nth-child(${cellIndex + 1}) .value`);
}
