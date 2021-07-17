/**
 *
 * @param {[number[], number[], number[], number[]]} borderHints
 * @param {number[][]} buildings
 * @param {Set<number>[][]} allowedHeights
 * @returns {Generator<[number, number, number, number]>}
 */
export function* solve(
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
