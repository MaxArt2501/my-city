// @ts-check
/**
 * Serializes a city into an envoded string
 * @param {City} currentCity
 * @returns {string}
 */
export function serializeCity(currentCity) {
  const cityData = new Uint8Array(1 + currentCity.width + currentCity.height);
  cityData[0] = currentCity.width + (currentCity.height << 4);

  currentCity.borderHints[0].forEach((topHint, index) => {
    const bottomHint = currentCity.borderHints[2][currentCity.width - index - 1];
    cityData[index + 1] = topHint + (bottomHint << 4);
  });

  currentCity.borderHints[1].forEach((rightHint, index) => {
    const leftHint = currentCity.borderHints[3][currentCity.height - index - 1];
    cityData[index + 1 + currentCity.width] = leftHint + (rightHint << 4);
  });

  return new TextDecoder().decode(cityData.buffer);
}

/**
 * Deserializes a serialized city
 * @param {string} serialized
 * @returns {City}
 */
export function deserializeCity(serialized) {
  const cityData = new TextEncoder().encode(serialized);
  const width = cityData[0] & 15;
  const height = cityData[0] >> 4;

  /** @type {City} */
  const city = {
    width,
    height,
    borderHints: [new Array(width), new Array(height), new Array(width), new Array(height)]
  };
  for (let index = 0; index < city.width; index++) {
    const topHint = cityData[index + 1] & 15;
    const bottomHint = cityData[index + 1] >> 4;
    city.borderHints[0][index] = topHint;
    city.borderHints[2][city.width - index - 1] = bottomHint;
  }
  for (let index = 0; index < city.height; index++) {
    const leftHint = cityData[index + city.width + 1] & 15;
    const rightHint = cityData[index + city.width + 1] >> 4;
    city.borderHints[1][index] = rightHint;
    city.borderHints[3][city.height - index - 1] = leftHint;
  }
  return city;
}

/**
 * Returns a string representing the current state
 * @param {City} currentCity
 * @param {number[][]} buildings
 * @param {Set<number>[][]} marks
 * @returns {string}
 */
export function serializeState(currentCity, buildings, marks) {
  const citySize = currentCity.width * currentCity.height;
  const cityState = new Uint8Array(Math.ceil(citySize * 2.5));

  /** @type {number[]} */
  const allCells = buildings.flat();
  allCells.forEach((value, index) => {
    const cityIndex = index >> 1;
    cityState[cityIndex] = cityState[cityIndex] + (value << (index & 1 ? 4 : 0));
  });

  const marksData = new Uint16Array(citySize);
  /** @type {Set<number>[]} */
  const allMarks = marks.flat();
  allMarks.forEach((cellMarks, index) => {
    for (const mark of cellMarks) {
      marksData[index] = marksData[index] ^ (1 << (mark - 1));
    }
  });

  cityState.set(new Uint8Array(marksData.buffer), Math.ceil(citySize / 2));
  return new TextDecoder().decode(cityState.buffer);
}

/**
 * Returns a deserialized structured game state
 * @param {string} serialized
 * @param {number} width
 * @param {number} height
 * @returns {State}
 */
export function deserializeState(serialized, width, height) {
  const stateData = new TextEncoder().encode(serialized);
  const citySize = width * height;
  const values = Array.from({ length: citySize }, (_, index) => {
    const byte = stateData[index >> 1];
    return index & 1 ? byte >> 4 : byte & 15;
  });

  const markOffset = Math.ceil(citySize / 2);
  const maxValue = Math.max(width, height);
  const markData = new Uint16Array(stateData.buffer.slice(markOffset));
  /** @type {State} */
  const state = {
    buildings: Array.from({ length: height }, (_, index) => values.slice(index * width, (index + 1) * width)),
    marks: Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) => {
        /** @type {Set<number>} */
        const cellMarks = new Set();
        const index = row * width + column;
        const markByte = markData[index];
        for (let value = 1; value <= maxValue; value++) {
          if (markByte & (1 << (value - 1))) {
            cellMarks.add(value);
          }
        }
        return cellMarks;
      })
    )
  };
  return state;
}
