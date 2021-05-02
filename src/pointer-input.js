// @ts-check
import { field, markMode, updateCellValue } from './game.js';
import { getBuildingValue, getElementIndex } from './utils.js';

/** @type {number} */
let currentValue;

/** @type {InputMode} */
export const mode = 'pointer';

export function initialize() {
  field.addEventListener('click', handleClick);
  document.querySelector('.selectors').addEventListener('click', handleValueSelect);
  if (!currentValue) {
    setCurrentValue(1);
  }
}

export function terminate() {
  field.removeEventListener('click', handleClick);
  document.querySelector('.selectors').removeEventListener('click', handleValueSelect);
}

/**
 * @param {MouseEvent} event
 */
function handleClick({ target }) {
  /** @type {HTMLSpanElement} */
  const valueContainer = target.closest('.city .value');
  if (valueContainer && isFinite(currentValue)) {
    const value = markMode || getBuildingValue(valueContainer.parentElement) !== currentValue ? currentValue : 0;
    updateCellValue(valueContainer, value);
  }
}

/**
 * @param {MouseEvent} event
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
  document.querySelectorAll('.selectors button').forEach((button, index) => {
    button.setAttribute('aria-current', String(index === value - 1));
  });
}
