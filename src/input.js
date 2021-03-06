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
  placeHint,
  restartGame,
  stopClock,
  toggleMode,
  travelHistory,
  updateCellValue
} from './game.js';
import { initializeCamera, scanQRCode, showQRCode, startScan } from './share.js';
import { wipeData } from './storage.js';
import { getBuildingValue, getCoordinates, getElementIndex, shiftValue } from './utils.js';

/** @type {number} */
let currentValue;
/** @type {number} */
let cursorRow;
/** @type {number} */
let cursorColumn;

/** @type {Object.<string, HTMLDialogElement>} */
export const dialogs = ['sidebar', 'restartConfirm', 'help', 'about', 'import', 'wipeConfirm', 'noIdea', 'update', 'share'].reduce(
  (dialogMap, id) => Object.assign(dialogMap, { [id]: document.querySelector(`#${id}`) }),
  {}
);

export function initializeInput() {
  field.addEventListener('pointerdown', handleClick);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', ({ target, button }) => {
    if (button !== 0) {
      return;
    }
    /** @type {HTMLButtonElement} */
    const actionButton = target.closest('[data-action]');
    if (actionButton) {
      return handleAction(actionButton);
    }
    /** @type {HTMLButtonElement} */
    const valueButton = target.closest('.selectors button');
    if (valueButton) {
      return setCurrentValue(getElementIndex(valueButton) + 1);
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
function handleClick(event) {
  event.preventDefault();
  /** @type {HTMLDivElement} */
  const cell = event.target.closest('.city .cell');
  if (cell && isFinite(currentValue)) {
    const value = markMode || getBuildingValue(cell) !== currentValue ? currentValue : 0;
    const [row, column] = getCoordinates(cell);
    updateCellValue(row, column, value);
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
    updateCellValue(cursorRow, cursorColumn, currentValue);
  } else if (key === 'Delete' || key === 'Backspace') {
    if (markMode && marks[cursorRow][cursorColumn].has(currentValue)) {
      updateCellValue(cursorRow, cursorColumn, currentValue);
    } else if (!markMode) {
      updateCellValue(cursorRow, cursorColumn, buildings[cursorRow][cursorColumn]);
    }
  } else if (key.toLowerCase() === 'z' && ctrlKey && !shiftKey) {
    travelHistory(1);
  } else if ((key.toLowerCase() === 'z' && ctrlKey && shiftKey) || (key.toLowerCase() === 'y' && ctrlKey)) {
    travelHistory(-1);
  }
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
  const { action } = button.dataset;
  switch (action) {
    case 'help':
      dialogs.help.showModal();
      break;
    case 'about':
      dialogs.sidebar.close();
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
    case 'wipe':
      dialogs.wipeConfirm.showModal();
      break;
    case 'confirmWipe':
      wipeData().then(() => location.reload());
      break;
    case 'share':
      dialogs.sidebar.close();
      dialogs.share.showModal();
      showQRCode();
      break;
    case 'scan':
      dialogs.sidebar.close();
      scanQRCode();
      break;
    case 'retryScan':
      startScan();
      break;
    case 'changeCamera':
      initializeCamera();
      break;
    case 'fillMarks':
      dialogs.sidebar.close();
      fillMarks();
      break;
    case 'hint':
      placeHint();
      dialogs.sidebar.close();
      break;
    case 'update':
      stopClock();
      dialogs.update.showModal();
      break;
  }
}
