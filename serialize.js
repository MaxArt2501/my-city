// @ts-check
const B64 = Array.from({ length: 64 }, (_, num) => btoa(String.fromCharCode(num << 2))[0]).join('');
const triangles = Array.from({ length: 10 }, (_, number) => ((number + 1) * number) >> 1);

/**
 * Serializes a city into an encoded string - new, more compact representation
 * @param {City} city
 * @returns {string}
 */
export function serializeCity(city) {
  const { width, height, borderHints } = city;
  const rowMult = BigInt(((width * (width + 5)) >> 1) + 1);
  const colMult = BigInt(((height * (height + 5)) >> 1) + 1);

  let cityNumber = 0n;
  borderHints[0].forEach(
    (value, index) => (cityNumber = cityNumber * colMult + BigInt(pairIndex(value, borderHints[2][height - index - 1], height)))
  );
  borderHints[1].forEach(
    (value, index) => (cityNumber = cityNumber * rowMult + BigInt(pairIndex(value, borderHints[3][width - index - 1], width)))
  );
  cityNumber = cityNumber * 64n + BigInt(height - 2) * 8n + BigInt(width - 2);

  // Bonus: the first 6 bits (= first base64 character) contain the city
  // sizes. Very handy!
  return bigintToBase64(cityNumber);
}

/**
 * Deserializes a city serialized with the new representation
 * @param {string} string
 * @returns {City}
 */
export function deserializeCity(string) {
  const sizes = B64.indexOf(string[0]);
  const width = (sizes & 7) + 2;
  const height = (sizes >> 3) + 2;
  const rowMult = BigInt(((width * (width + 5)) >> 1) + 1);
  const colMult = BigInt(((height * (height + 5)) >> 1) + 1);

  let hintsNumber = base64ToBigint(string.slice(1));
  /** @type {BorderHints} */
  const borderHints = [[], [], [], []];
  for (let count = 0; count < height; count++) {
    const index = hintsNumber % rowMult;
    const [right, left] = pairFromIndex(Number(index), width);
    borderHints[1].unshift(right);
    borderHints[3].push(left);
    hintsNumber /= rowMult;
  }
  for (let count = 0; count < height; count++) {
    const index = hintsNumber % colMult;
    const [top, bottom] = pairFromIndex(Number(index), width);
    borderHints[0].unshift(top);
    borderHints[2].push(bottom);
    hintsNumber /= colMult;
  }

  return { width, height, borderHints };
}

/**
 *
 * @param {bigint} bigint
 */
function bigintToBase64(bigint) {
  let encoded = '';
  let temp = bigint;
  while (temp > 0n) {
    encoded += B64[Number(temp % 64n)];
    temp /= 64n;
  }
  return encoded;
}

/**
 *
 * @param {string} string
 * @returns {bigint}
 */
function base64ToBigint(string) {
  return string.split('').reduceRight((total, char) => total * 64n + BigInt(B64.indexOf(char)), 0n);
}

/**
 * Returns the index of a number pair [first, second] such that first + second <= maximum + 1
 * @param {number} first
 * @param {number} second
 * @param {number} maximum
 * @returns {number}
 */
function pairIndex(first, second, maximum) {
  if (first === 0) {
    return second;
  }
  return triangles[maximum + 1] - triangles[maximum + 2 - first] + second + maximum + 1;
}

/**
 * Returns a numeric pair from the given index.
 * @see pairIndex
 * @param {number} index
 * @param {number} maximum
 * @returns {[number, number]}
 */
function pairFromIndex(index, maximum) {
  if (index <= maximum) {
    return [0, index];
  }
  let first = 1;
  let second = index - maximum - 1;
  for (let adder = maximum + 1; adder > 0; first++, second -= adder--) {
    if (second < adder) {
      return [first, second];
    }
  }
}

/**
 * Returns a string representing the current state - new, more compact representation
 * @param {City} city
 * @param {number[][]} buildings
 * @param {Set<number>[][]} marks
 * @returns {string}
 */
export function serializeState(city, buildings, marks) {
  const maxValue = BigInt(Math.max(city.width, city.height));
  const modulo = 2n ** maxValue * (maxValue + 1n);

  const allMarks = marks.flat();
  const stateNumber = buildings.flat().reduce((number, building, index) => {
    const cellMarks = Array.from(allMarks[index]);
    const marksNumber = cellMarks.reduce((bitmask, mark) => bitmask ^ (1 << (mark - 1)), 0);
    const cellNumber = BigInt(marksNumber) * (maxValue + 1n) + BigInt(building);
    return number * modulo + cellNumber;
  }, 0n);

  return bigintToBase64(stateNumber);
}

/**
 * Returns a deserialized structured game state - new, more compact representation
 * @param {string} serialized
 * @param {number} width
 * @param {number} height
 * @returns {State}
 */
export function deserializeState(serialized, width, height) {
  let stateNumber = base64ToBigint(serialized);
  const maxValue = BigInt(Math.max(width, height));
  const modulo = 2n ** maxValue * (maxValue + 1n);

  const allCells = Array.from({ length: width * height }, () => {
    const value = stateNumber % modulo;
    stateNumber /= modulo;
    return value;
  }).reverse();

  /** @type {number[][]} */
  const buildings = Array.from({ length: height }, () => Array(width));
  /** @type {Set<number>[][]} */
  const marks = Array.from({ length: height }, () => Array.from({ length: width }, () => new Set()));

  allCells.forEach((cellNumber, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    buildings[row][column] = Number(cellNumber % (maxValue + 1n));
    const marksNumber = Number(cellNumber / (maxValue + 1n));
    const cellMarks = marks[row][column];
    for (let value = 1; value <= maxValue; value++) {
      if (marksNumber & (1 << (value - 1))) {
        cellMarks.add(value);
      }
    }
  });

  return { buildings, marks };
}
