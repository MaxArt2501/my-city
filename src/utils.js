// @ts-check
import { buildings, currentCity } from './game.js';

/**
 * Renders a data array, creating new elements when needed and removing
 * @type {ListRenderer}
 */
export function renderForList(dataList, existingElements, elementFactory, elementUpdater) {
  dataList.forEach((dataItem, index) => {
    const element = index >= existingElements.length ? elementFactory(index) : existingElements[index];
    elementUpdater(element, dataItem, index);
  });
  for (let index = existingElements.length - 1; index >= dataList.length; index--) {
    existingElements[index].remove();
  }
}

/**
 * Returns and empty state for the current city
 * @returns {State}
 */
export function createEmptyState() {
  return {
    buildings: Array.from({ length: currentCity.height }, () => Array(currentCity.width).fill(0)),
    marks: Array.from({ length: currentCity.height }, () => Array.from({ length: currentCity.width }, () => new Set()))
  };
}

/**
 * Returns the index of an element among its element siblings
 * @param {Element} element
 */
export function getElementIndex(element) {
  return Array.from(element.parentNode.children).indexOf(element);
}

/**
 * Returns the coordinates [row, column] of the given building cell, as a
 * couple of numbers
 * @param {HTMLElement} building
 * @returns {number[]}
 */
export function getCoordinates(building) {
  const cellIndex = getElementIndex(building);
  const column = cellIndex % currentCity.width;
  const row = Math.floor(cellIndex / currentCity.width);
  return [row, column];
}

/**
 * Returns the value of the given building cell
 * @param {HTMLElement} building
 * @returns {number}
 */
export function getBuildingValue(building) {
  const [row, column] = getCoordinates(building);
  return buildings[row][column];
}

/**
 * @param {number[]} sequence
 * @returns {StairsRanges}
 */
export function getStairsRanges(sequence) {
  const availableHeights = getMissingValues(sequence);
  if (availableHeights.length > 0) {
    const minStart = getStairsLength(getWorstRisingSequence(sequence, availableHeights));
    const minEnd = getStairsLength(getWorstRisingSequence(sequence.slice().reverse(), availableHeights));
    const maxStart = getStairsLength(getBestRisingSequence(sequence, availableHeights));
    const maxEnd = getStairsLength(getBestRisingSequence(sequence.slice().reverse(), availableHeights));
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
 * Returns the numbers that are missing from the sequence
 * @param {number[]} sequence The missing values, in ascending order
 */
function getMissingValues(sequence) {
  return Array.from(sequence, (_, index) => index + 1).filter(value => !sequence.includes(value));
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
 * Returns the longest possible monotone sequence from a sequence with missing
 * numbers. Maybe not the most efficient, but good enough...
 * @param {number[]} sequence
 * @param {number[]} remaining
 */
function getBestRisingSequence(sequence, remaining) {
  let low = 0;
  let high = Infinity;
  return sequence.map((value, index) => {
    if (value) {
      low = Math.max(low, value);
      high = Math.min(...sequence.slice(index + 1).filter(cell => cell > value));
      return value;
    }
    const fitIndex = remaining.findIndex(height => height > low && height < high);
    if (fitIndex >= 0) {
      low = remaining[fitIndex];
      remaining = [...remaining.slice(0, fitIndex), ...remaining.slice(fitIndex + 1)];
      return low;
    }
    const height = remaining[0];
    remaining = remaining.slice(1);
    return height;
  });
}

/**
 * Returns the shortest possible monotone sequence from a sequence with missing
 * numbers. Maybe not the most efficient, but good enough...
 * @param {number[]} sequence
 * @param {number[]} remaining
 */
function getWorstRisingSequence(sequence, remaining) {
  let low = 0;
  let high = Infinity;
  return sequence.map((value, index) => {
    if (value) {
      low = Math.max(low, value);
      high = Math.min(...sequence.slice(index + 1).filter(cell => cell > value));
      return value;
    }
    const tallest = remaining[remaining.length - 1];
    if (tallest > high || remaining[0] > low) {
    remaining = remaining.slice(0, -1);
    return tallest;
    }
    const shortest = remaining[0];
    remaining = remaining.slice(1);
    return shortest;
  });
}

/**
 * Shifts a value by a given amount, wrapping around the maximum given value
 * @param {number} value
 * @param {number} shift
 * @param {number} max
 * @returns
 */
export const shiftValue = (value, shift, max) => (value + max + shift) % max;

/**
 * Converts the given duration in milliseconds to a ISO8601-formatted duration
 * string
 * @see https://www.w3.org/TR/2014/REC-html5-20141028/infrastructure.html#durations
 * @param {number} millis
 * @returns {string}
 */
export function toISODuration(millis) {
  const hours = millis > 36e5 ? `${Math.floor(millis / 36e5)}H` : '';
  const minutes = millis % 36e5 > 6e4 ? `${Math.floor((millis % 36e5) / 6e4)}M` : '';
  const seconds = millis % 6e4 ? String((millis % 6e4) / 1000) : '';
  return `PT${hours}${minutes}${seconds}`;
}

const DURATION_RE = /^PT(?:(\d+)H)?(?:(\d+)M)?(\d*(?:\.\d+)?)?$/;
/**
 * Converts the given ISO8601-formatted duration string to its corresponding
 * amount in milliseconds
 * @param {string} string
 * @returns {number}
 */
export function fromISODuration(string) {
  const match = string.match(DURATION_RE);
  if (!match) {
    return NaN;
  }
  return (+match[1] || 0) * 36e5 + (+match[2] || 0) * 6e4 + (+match[3] || 0) * 1000;
}

const ATTEMPT_TIME_RE = / (PT[\d\.HM]*)\*?$/;

/**
 * Returns the elapsed time of an attempt
 * @param {string} attempt
 * @returns {number}
 */
export function getAttemptElapsed(attempt) {
  const elapsedMatch = attempt.match(ATTEMPT_TIME_RE);
  if (!elapsedMatch) {
    console.error(`Malformed attempt string: "${attempt}"`);
  }
  return elapsedMatch ? fromISODuration(elapsedMatch[1]) : 0;
}

/**
 * Returns the given amount of milliseconds in the format mm:ss
 * @param {number} millis
 * @returns {string}
 */
export function formatElapsed(millis) {
  return `${Math.floor(millis / 6e4)
    .toString()
    .padStart(2, '0')}:${Math.floor((millis % 6e4) / 1000)
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Checks whether the given attempt is successful
 * @param {string} attempt
 * @returns {boolean}
 */
export function isAttemptSuccessful(attempt) {
  return !!attempt && attempt.endsWith('*');
}

/**
 * Checks if the argument is a valid attempt string
 * @param {*} attempt
 * @returns {boolean}
 */
export function isValidAttempt(attempt) {
  if (typeof attempt !== 'string') {
    return false;
  }
  const timestamp = attempt.slice(0, attempt.indexOf(' '));
  return !isNaN(Date.parse(timestamp)) && ATTEMPT_TIME_RE.test(attempt);
}

const MEBIBYTE = 1048576;
const KIBIBYTE = 1024;
/**
 * Formats the given amount of bytes in a human-readable format
 * @param {number} amount
 * @returns {string}
 */
export function formatSize(amount) {
  if (amount >= MEBIBYTE) {
    return `${+(amount / MEBIBYTE).toFixed(1)} MiB`;
  }
  if (amount >= KIBIBYTE) {
    return `${+(amount / KIBIBYTE).toFixed(1)} KiB`;
  }
  return `${amount} bytes`;
}

/**
 * Returns errors for duplicate building heights in rows and columns
 * @param {number[][]} buildings
 * @returns {Generator<GameError>}
 */
export function* getFieldErrors(buildings) {
  const width = buildings[0].length;
  for (let rowIndex = 0; rowIndex < buildings.length; rowIndex++) {
    const row = buildings[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex];
      if (!cell) {
        continue;
      }
      const cellIndex = rowIndex * width + colIndex;
      for (let checkRowIndex = 0; checkRowIndex < buildings.length; checkRowIndex++) {
        const checkRow = buildings[checkRowIndex];
        const checkCell = checkRow[colIndex];
        if (cell === checkCell && rowIndex !== checkRowIndex) {
          yield {
            type: 'cell',
            message: `There is another "${cell}" in this column`,
            index: cellIndex
          };
        }
      }
      if (row.indexOf(cell) !== colIndex || row.lastIndexOf(cell) !== colIndex) {
        yield {
          type: 'cell',
          message: `There is another "${cell}" in this row`,
          index: cellIndex
        };
      }
    }
  }
}

/**
 * Returns errors for unsatisfied border hints
 * @param {number[][]} buildings
 * @param {BorderHints} borderHints
 * @returns {Generator<GameError>}
 */
export function* getBorderErrors(buildings, borderHints) {
  const width = buildings[0].length;
  const height = buildings.length;
  for (let index = 0; index < height; index++) {
    const startHint = borderHints[3][height - index - 1];
    const endHint = borderHints[1][index];
    if (!startHint && !endHint) {
      continue;
    }

    const row = buildings[index];
    const ranges = getStairsRanges(row);
    if ((startHint && startHint < ranges.start[0]) || startHint > ranges.start[1]) {
      yield {
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index: 2 * (width + height) - index - 1
      };
    }
    if ((endHint && endHint < ranges.end[0]) || endHint > ranges.end[1]) {
      yield {
        type: 'border',
        message: `The constraint "${endHint}" cannot be satisfied`,
        index: width + index
      };
    }
  }
  for (let index = 0; index < width; index++) {
    const startHint = borderHints[0][index];
    const endHint = borderHints[2][width - index - 1];
    if (!startHint && !endHint) {
      continue;
    }

    const column = buildings.map(row => row[index]);
    const ranges = getStairsRanges(column);
    if (startHint && (startHint < ranges.start[0] || startHint > ranges.start[1])) {
      yield {
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index
      };
    }
    if (endHint && (endHint < ranges.end[0] || endHint > ranges.end[1])) {
      yield {
        type: 'border',
        message: `The constraint "${endHint}" cannot be satisfied`,
        index: 2 * width + height - index - 1
      };
    }
  }
}

/**
 *
 * @param {number[][]} buildings
 * @param {[number[], number[], number[], number[]]} borderHints
 */
export function getAllowedHeights(buildings, borderHints) {
  const maxSize = Math.max(buildings.length, buildings[0].length);
  const cityClone = buildings.map(row => row.slice());
  return buildings.map((row, rowIndex) => {
    return row.map((cell, colIndex) => {
      /** @type {Set<number>} */
      const marks = new Set();
      if (!cell) {
        for (let height = 1; height <= maxSize; height++) {
          cityClone[rowIndex][colIndex] = height;
          const firstFieldError = getFieldErrors(cityClone).next().value;
          if (firstFieldError) {
            continue;
          }
          const firstBorderError = getBorderErrors(cityClone, borderHints).next().value;
          if (!firstBorderError) {
            marks.add(height);
          }
        }
        cityClone[rowIndex][colIndex] = cell;
      }
      return marks;
    });
  });
}
