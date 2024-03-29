// @ts-check
self.addEventListener(
  'message',
  /** @param {MessageEvent<SolverRequest>} event */ event => {
    setTimeout(() => {
      let result;
      switch (event.data.request) {
        case 'hint': {
          const solver = solve(event.data.borderHints, event.data.buildings);
          result = solver.next().value;
          break;
        }
        case 'difficulty': {
          const moves = Array.from(solve(event.data.borderHints));
          const totalSolvingCost = moves.reduce((sum, [, , , cost]) => sum + cost, 0);
          const cityWidth = event.data.borderHints[0].length;
          const cityHeight = event.data.borderHints[1].length;
          result = totalSolvingCost / (cityWidth + cityHeight) - 2;
          break;
        }
        case 'getAllowedHeights':
          result = getAllowedHeights(event.data.buildings, event.data.borderHints);
          break;
        case 'getFieldErrors':
          result = Array.from(getFieldErrors(event.data.buildings));
          break;
        case 'getBorderErrors':
          result = Array.from(getBorderErrors(event.data.buildings, event.data.borderHints));
          break;
        case 'computeCityDifficulty':
          result = computeCityDifficulty(event.data.borderHints);
          break;
      }
      // @ts-ignore TS doesn't consider this a Web Worker, so requires a second argument
      self.postMessage({ token: event.data.token, result });
    }, 0);
  }
);

/**
 * @param {number[]} sequence
 * @returns {StairsRanges}
 */
function getStairsRanges(sequence) {
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
      high = sequence.slice(index + 1).find(cell => cell > value) || Infinity;
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
  return sequence.map((value, index) => {
    if (value) {
      return value;
    }
    const shortest = remaining[0];
    const tallest = remaining[remaining.length - 1];
    const prevTallest = Math.max(...sequence.slice(0, index));
    const nextTaller = sequence.slice(index + 1).find(height => height > prevTallest) || 0;
    if (tallest > nextTaller || shortest > prevTallest) {
      remaining = remaining.slice(0, -1);
      return tallest;
    }
    remaining = remaining.slice(1);
    return shortest;
  });
}

/**
 *
 * @param {number[]} sequence
 * @param {number} startHint
 * @param {number} endHint
 * @returns {[boolean, boolean]}
 */
function getConstraintsErrors(sequence, startHint, endHint) {
  const ranges = getStairsRanges(sequence);
  return [
    (startHint && startHint < ranges.start[0]) || startHint > ranges.start[1],
    (endHint && endHint < ranges.end[0]) || endHint > ranges.end[1]
  ];
}

/**
 * Returns the nth column of a matrix
 * @param {number[][]} buildings
 * @param {number} column
 * @returns {number[]}
 */
function getColumn(buildings, column) {
  return buildings.map(row => row[column]);
}

/**
 *
 * @param {number[]} sequence
 * @returns {Generator<number, void, void>}
 */
function* getDuplicateErrors(sequence) {
  for (let index = 0; index < sequence.length; index++) {
    const value = sequence[index];
    if (!value) {
      continue;
    }
    if (
      (index < sequence.length - 1 && sequence.indexOf(value, index + 1) >= 0) ||
      (index > 0 && sequence.lastIndexOf(value, index - 1) >= 0)
    ) {
      yield index;
    }
  }
}

/**
 * Returns errors for duplicate building heights in rows and columns
 * @param {number[][]} buildings
 * @returns {Generator<GameError, void, void>}
 */
function* getFieldErrors(buildings) {
  const width = buildings[0].length;
  for (let row = 0; row < buildings.length; row++) {
    const errorGen = getDuplicateErrors(buildings[row]);
    /** @type {IteratorResult<number, void>} */
    let errorResult;
    while (typeof (errorResult = errorGen.next()).value === 'number') {
      yield {
        type: 'cell',
        message: `There is another "${buildings[row][errorResult.value]}" in this row`,
        index: width * row + errorResult.value
      };
    }
  }
  for (let column = 0; column < buildings[0].length; column++) {
    const errorGen = getDuplicateErrors(getColumn(buildings, column));
    /** @type {IteratorResult<number, void>} */
    let errorResult;
    while (typeof (errorResult = errorGen.next()).value === 'number') {
      yield {
        type: 'cell',
        message: `There is another "${buildings[errorResult.value][column]}" in this column`,
        index: width * errorResult.value + column
      };
    }
  }
}

/**
 *
 * @param {number[]} sequence
 * @param {number} startHint
 * @param {number} endHint
 * @returns {[boolean, boolean]}
 */
function getConstraintsErrors(sequence, startHint, endHint) {
  const ranges = getStairsRanges(sequence);
  return [
    (startHint && startHint < ranges.start[0]) || startHint > ranges.start[1],
    (endHint && endHint < ranges.end[0]) || endHint > ranges.end[1]
  ];
}

/**
 * Returns errors for unsatisfied border hints
 * @param {number[][]} buildings
 * @param {BorderHints} borderHints
 * @returns {Generator<GameError, void, void>}
 */
function* getBorderErrors(buildings, borderHints) {
  const width = buildings[0].length;
  const height = buildings.length;
  for (let index = 0; index < height; index++) {
    const startHint = borderHints[3][height - index - 1];
    const endHint = borderHints[1][index];
    if (!startHint && !endHint) {
      continue;
    }

    const [startError, endError] = getConstraintsErrors(buildings[index], startHint, endHint);
    if (startError) {
      yield {
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index: 2 * (width + height) - index - 1
      };
    }
    if (endError) {
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

    const [startError, endError] = getConstraintsErrors(getColumn(buildings, index), startHint, endHint);
    if (startError) {
      yield {
        type: 'border',
        message: `The constraint "${startHint}" cannot be satisfied`,
        index
      };
    }
    if (endError) {
      yield {
        type: 'border',
        message: `The constraint "${endHint}" cannot be satisfied`,
        index: 2 * width + height - index - 1
      };
    }
  }
}

/**
 * Returns a set of allowed heights (i.e., values that wouldn't cause an error
 * if placed there) for a given cell in the city grid
 * @param {number[][]} buildings
 * @param {BorderHints} borderHints
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {Set<number>}
 */
function getAllowedCellHeights(buildings, borderHints, rowIndex, columnIndex) {
  const [width, height] = [buildings[0].length, buildings.length];
  const maxSize = Math.max(width, height);

  const row = buildings[rowIndex].slice();
  const column = getColumn(buildings, columnIndex);
  /** @type {[number, number]} */
  const rowHints = [borderHints[3][height - rowIndex - 1], borderHints[1][rowIndex]];
  /** @type {[number, number]} */
  const colHints = [borderHints[0][columnIndex], borderHints[2][width - columnIndex - 1]];

  /** @type {Set<number>} */
  const marks = new Set();

  for (let value = 1; value <= maxSize; value++) {
    if (row.includes(value) || column.includes(value)) {
      continue;
    }
    row[columnIndex] = value;
    const rowErrors = getConstraintsErrors(row, ...rowHints);
    if (!rowErrors.includes(true)) {
      column[rowIndex] = value;
      const colErrors = getConstraintsErrors(column, ...colHints);
      if (!colErrors.includes(true)) {
        marks.add(value);
      }
    }
  }

  return marks;
}

/**
 * Returns a set of allowed heights (i.e., values that wouldn't cause an error
 * if placed there) for each cell in the city grid
 * @param {number[][]} buildings
 * @param {BorderHints} borderHints
 * @returns {Set<number>[][]}
 */
function getAllowedHeights(buildings, borderHints) {
  return buildings.map((row, rowIndex) => {
    return row.map((cell, colIndex) => {
      return cell === 0 ? getAllowedCellHeights(buildings, borderHints, rowIndex, colIndex) : new Set();
    });
  });
}

/**
 *
 * @param {Set<number>[][]} marks
 * @returns {[number, number]}
 */
function findNextDetermined(marks) {
  for (let row = 0; row < marks.length; row++) {
    for (let column = 0; column < marks[row].length; column++) {
      if (marks[row][column].size === 1) {
        return [row, column];
      }
    }
  }
}

/**
 * Generates the moves to solve a puzzle
 * @param {BorderHints} borderHints
 * @param {number[][]} buildings
 * @param {Set<number>[][]} allowedHeights
 * @returns {Generator<[number, number, number, number]>}
 */
function* solve(
  borderHints,
  buildings = borderHints[0].map(() => new Array(borderHints[1].length).fill(0)),
  allowedHeights = getAllowedHeights(buildings, borderHints)
) {
  const maxSize = Math.max(buildings.length, buildings[0].length);
  const cityClone = buildings.map(row => row.slice());

  /**
   * @param {number} row
   * @param {number} column
   * @param {number} value
   * @returns {[number, number, number]}
   */
  function placeHeight(row, column, value) {
    hasFound = true;
    cityClone[row][column] = value;
    cityClone.forEach((rowValues, rowIndex) => {
      if (rowValues[column] === 0) {
        allowedHeights[rowIndex][column] = getAllowedCellHeights(cityClone, borderHints, rowIndex, column);
      }
    });
    cityClone[row].forEach((cell, colIndex) => {
      if (cell === 0) {
        allowedHeights[row][colIndex] = getAllowedCellHeights(cityClone, borderHints, row, colIndex);
      }
    });
    allowedHeights[row][column].clear();
    return [row, column, value];
  }

  /** @type {boolean} */
  let hasFound;
  do {
    hasFound = false;

    /** @type {[number, number]} */
    let detemined;
    while ((detemined = findNextDetermined(allowedHeights))) {
      const [row, column] = detemined;
      const [value] = [...allowedHeights[row][column]];
      yield [...placeHeight(row, column, value), 1];
    }

    for (let height = maxSize; height > 0; height--) {
      for (let row = 0; row < allowedHeights.length; row++) {
        const setRow = allowedHeights[row];
        if (setRow.some((set, column) => !cityClone[row][column] && set.size === 0)) {
          // There's been a problem with the given configuration
          return;
        }
        const hasHeight = setRow.filter(set => set.has(height));
        if (hasHeight.length === 1) {
          yield [...placeHeight(row, setRow.indexOf(hasHeight[0]), height), 2];
        }
      }
      for (let column = 0; column < allowedHeights[0].length; column++) {
        const setColumn = allowedHeights.map(setRow => setRow[column]);
        const hasHeight = setColumn.filter(set => set.has(height));
        if (hasHeight.length === 1) {
          yield [...placeHeight(setColumn.indexOf(hasHeight[0]), column, height), 2];
        }
      }
    }
  } while (hasFound);

  const missingHeights = cityClone.reduce((sum, row) => sum + row.filter(height => !height).length, 0);
  if (missingHeights === 0) {
    return;
  }

  /** @type {[number, number]} */
  let bestSet;
  allowedHeights.forEach((setRow, row) => {
    setRow.forEach((set, column) => {
      if (set.size > 1 && (!bestSet || set.size < allowedHeights[bestSet[0]][bestSet[1]].size)) {
        bestSet = [row, column];
      }
    });
  });
  const [bestRow, bestCol] = bestSet;

  const alternatives = Array.from(allowedHeights[bestRow][bestCol]);
  const moveGens = alternatives.map(height => {
    placeHeight(bestRow, bestCol, height);
    return solve(
      borderHints,
      cityClone.map(row => row.slice()),
      allowedHeights.map(row => row.map(set => new Set(set)))
    );
  });
  /** @type {Array<Array<[number, number, number, number]>>} */
  const moveLists = moveGens.map(() => []);

  /** @type {Array<IteratorResult<[number, number, number, number], void>>} */
  let moveResults;
  do {
    moveResults = moveGens.map(gen => gen.next());
    moveResults.forEach(({ value }, index) => {
      if (value) {
        moveLists[index].push(value);
      }
    });
  } while (moveResults.some(({ done }) => !done));

  const longest = Math.max(...moveLists.map(list => list.length));
  if (longest >= 0) {
    const longestIndex = moveLists.findIndex(({ length }) => length === longest);
    yield [bestRow, bestCol, alternatives[longestIndex], 4];
    for (const move of moveLists[longestIndex]) {
      yield move;
    }
  }
}

/**
 * Should return a number between 0 and 5
 * @param {BorderHints} borderHints
 * @returns {number}
 */
function computeCityDifficulty(borderHints) {
  const moves = Array.from(solve(borderHints));
  const totalSolvingCost = moves.reduce((sum, [, , , cost]) => sum + cost, 0);
  return totalSolvingCost / (borderHints[0].length + borderHints[1].length) - 2;
}
