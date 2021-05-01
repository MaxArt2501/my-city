// @ts-check
import { currentCity, field, toggleMode, updateCellValue } from './game.js';

export function initialize() {
  field.addEventListener('click', clickHandler);
  document.addEventListener('keypress', keypressHandler);
}

export function terminate() {
  field.removeEventListener('click', clickHandler);
  document.removeEventListener('keypress', keypressHandler);
  const { activeElement } = document;
  if (activeElement?.matches('.value[contenteditable=true]')) {
    activeElement?.blur();
  }
}

/**
 * @param {MouseEvent} event
 */
function clickHandler({ target }) {
  /** @type {HTMLSpanElement} */
  const valueContainer = target.closest('.city .value');
  if (valueContainer) {
    handleClick(valueContainer);
  }
}

/**
 * @param {KeyboardEvent} event
 */
function keypressHandler({ key }) {
  if (key.toLowerCase() === 'm') {
    toggleMode();
  }
}

/**
 * Handles the click on a building cell
 * @param {HTMLSpanElement} valueContainer
 */
function handleClick(valueContainer) {
  /** @type {HTMLSpanElement?} */
  const editableContainer = field.querySelector('.value[contenteditable=true]');
  if (editableContainer && valueContainer !== editableContainer) {
    editableContainer.contentEditable = 'false';
  }
  valueContainer.contentEditable = 'true';
  valueContainer.focus();
  valueContainer.addEventListener('keydown', handleInput);
  valueContainer.addEventListener(
    'blur',
    () => {
      valueContainer.contentEditable = 'false';
      valueContainer.removeEventListener('keydown', handleInput);
    },
    { once: true }
  );
}

/**
 * @param {KeyboardEvent} event
 */
function handleInput(event) {
  const valueContainer = event.target;
  if (isFinite(+event.key) && event.key !== '0' && +event.key <= Math.max(currentCity.width, currentCity.height)) {
    updateCellValue(valueContainer, +event.key);
    valueContainer.blur();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    updateCellValue(valueContainer, 0);
    valueContainer.blur();
  } else if (event.key === 'Escape' || event.key === 'Enter') {
    valueContainer.blur();
  } else {
    event.preventDefault();
  }
}
