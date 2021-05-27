// @ts-check
import { exportData } from './data-manager.js';
import {
  buildings,
  currentCity,
  field,
  fillMarks,
  isCityComplete,
  markMode,
  marks,
  restartGame,
  stopClock,
  toggleMode,
  travelHistory,
  updateCellValue
} from './game.js';
import { getBuildingValue, getCoordinates, getElementIndex, shiftValue } from './utils.js';

/** @type {number} */
let currentValue;
/** @type {number} */
let cursorRow;
/** @type {number} */
let cursorColumn;

/** @type {Object.<string, HTMLDialogElement>} */
export const dialogs = ['sidebar', 'restartConfirm', 'help', 'about', 'import'].reduce(
  (dialogMap, id) => Object.assign(dialogMap, { [id]: document.querySelector(`#${id}`) }),
  {}
);

export function initializeInput() {
  field.addEventListener('pointerdown', handleClick);
  document.querySelector('.selectors').addEventListener('pointerdown', handleValueSelect);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('pointerdown', ({ target }) => {
    /** @type {HTMLButtonElement} */
    const actionButton = target.closest('button[data-action]');
    if (actionButton) {
      handleAction(actionButton);
    }
  });
}

export function resetControls() {
  setPosition(0, 0);
  setCurrentValue(1);
}

/**
 * @param {PointerEvent} event
 */
function handleClick({ target }) {
  /** @type {HTMLDivElement} */
  const cell = target.closest('.city .cell');
  if (cell && isFinite(currentValue)) {
    const value = markMode || getBuildingValue(cell) !== currentValue ? currentValue : 0;
    updateCellValue(cell, value);
    const [row, column] = getCoordinates(cell);
    setPosition(row, column, true);
  }
}

const arrows = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

/** @type {ArrowGuard} */
const isDirectionArrow = key => arrows.includes(key);

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown({ key, ctrlKey, shiftKey }) {
  if (!currentCity) {
    return;
  }
  if (isDirectionArrow(key)) {
    const keyIndex = arrows.indexOf(key);
    const rowShift = (keyIndex & 1) === 0 ? keyIndex - 1 : 0;
    const columnShift = (keyIndex & 1) === 0 ? 0 : 2 - keyIndex;
    setPosition(shiftValue(cursorRow, rowShift, currentCity.height), shiftValue(cursorColumn, columnShift, currentCity.width));
  } else if (isFinite(+key) && +key > 0 && +key <= Math.max(currentCity.width, currentCity.height)) {
    setCurrentValue(+key);
  } else if (key.toLowerCase() === 'm') {
    toggleMode();
  } else if (key === 'Enter' || key === ' ') {
    updateCellValue(getCurrentCell(), currentValue);
  } else if (key === 'Delete' || key === 'Backspace') {
    if (markMode && marks[cursorRow][cursorColumn].has(currentValue)) {
      updateCellValue(getCurrentCell(), currentValue);
    } else if (!markMode) {
      updateCellValue(getCurrentCell(), buildings[cursorRow][cursorColumn]);
    }
  } else if (key.toLowerCase() === 'z' && ctrlKey && !shiftKey) {
    travelHistory(1);
  } else if ((key.toLowerCase() === 'z' && ctrlKey && shiftKey) || (key.toLowerCase() === 'y' && ctrlKey)) {
    travelHistory(-1);
  }
}

/**
 * @param {PointerEvent} event
 */
function handleValueSelect({ target }) {
  const button = target.closest('button');
  if (!button) {
    return;
  }
  setCurrentValue(getElementIndex(button) + 1);
}

/**
 *
 * @param {number} value
 */
function setCurrentValue(value) {
  currentValue = value;
  field.dataset.currentValue = String(value);
  document.querySelectorAll('.selectors button').forEach((button, index) => {
    button.setAttribute('aria-current', String(index === value - 1));
  });
}

/**
 *
 * @param {number} row
 * @param {number} column
 * @param {boolean} [fromClick=false]
 */
function setPosition(row, column, fromClick = false) {
  cursorRow = row;
  cursorColumn = column;
  const previousCell = field.querySelector('.cell[aria-current="true"]');
  previousCell?.setAttribute('aria-current', 'false');
  previousCell?.classList.remove('from-click');
  const cell = getCurrentCell();
  cell?.setAttribute('aria-current', 'true');
  cell?.classList.toggle('from-click', fromClick);
}

/**
 * Returns the value container of the call of the cursor's coordinates
 * @returns {HTMLDivElement}
 */
function getCurrentCell() {
  const cellIndex = cursorRow * currentCity.width + cursorColumn;
  return field.querySelector(`.city .cell:nth-child(${cellIndex + 1})`);
}

/**
 * Handles actions from the sidebar menu
 * @param {HTMLButtonElement} button
 */
function handleAction(button) {
  const action = button.dataset.action;
  switch (action) {
    case 'help':
      dialogs.help.showModal();
      break;
    case 'about':
      dialogs.about.showModal();
      break;
    case 'restart':
      if (isCityComplete()) {
        restartGame();
        dialogs.sidebar.close();
      } else {
        dialogs.restartConfirm.showModal();
      }
      break;
    case 'confirmRestart':
      dialogs.restartConfirm.close();
      dialogs.sidebar.close();
      restartGame();
      break;
    case 'undo':
      travelHistory(1);
      break;
    case 'redo':
      travelHistory(-1);
      break;
    case 'toggleGameMode':
      toggleMode();
      break;
    case 'toggleSidebar':
      if (dialogs.sidebar.open) {
        dialogs.sidebar.close();
      } else {
        dialogs.sidebar.showModal();
        if (document.body.dataset.currentCity) {
          stopClock();
        }
      }
      break;
    case 'closeDialog':
      const dialog = button.closest('dialog');
      dialog?.close();
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      dialogs.import.showModal();
      break;
    case 'fillMarks':
      dialogs.sidebar.close();
      fillMarks();
      break;
  }
}
