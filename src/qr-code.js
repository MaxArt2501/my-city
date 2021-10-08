// @ts-check
self.addEventListener(
  'message',
  /** @param {MessageEvent<string>} event */ event => {
    setTimeout(() => {
      // @ts-ignore TS doesn't consider this a Web Worker, so requires a second argument
      self.postMessage({ cityId: event.data, qrCode: getQRCode(event.data) });
    }, 0);
  }
);

// This stuff is fixed: we won't need larger or smaller QR codes here
const QR_CODE_VERSION = 2;
const SIZE = 17 + QR_CODE_VERSION * 4;
// Data + EDC codewords for version-2 QR Codes
const TOTAL_CODEWORDS = 44;

// Capacity limits for version-2 QR Codes in byte mode given a correction level
const LIMITS = {
  H: 14,
  Q: 20,
  M: 26,
  L: 32
};
LIMITS.entries = Object.entries(LIMITS);
const EDC_ORDER = 'MLHQ';

const LOG = new Uint8Array(256);
const EXP = new Uint8Array(256);
for (let exponent = 1, value = 1; exponent < 256; exponent++) {
  value = value > 127 ? (value << 1) ^ 285 : value << 1;
  LOG[value] = exponent % 255;
  EXP[exponent % 255] = value;
}

function getNewMatrix() {
  return Array.from({ length: SIZE }, () => new Uint8Array(SIZE));
}

const RESERVED_AREAS = getNewMatrix();
// Finder patterns + divisors
placePattern(new Array(9).fill(0b111111111), 0, 0, 9, RESERVED_AREAS);
placePattern(new Array(9).fill(0b11111111), 0, SIZE - 8, 8, RESERVED_AREAS);
placePattern(new Array(8).fill(0b111111111), SIZE - 8, 0, 9, RESERVED_AREAS);
// Alignment pattern
placePattern(new Array(5).fill(0b11111), SIZE - 9, SIZE - 9, 5, RESERVED_AREAS);
// Timing patterns
placePattern([(1 << (QR_CODE_VERSION * 4)) - 1], 6, 9, QR_CODE_VERSION * 4, RESERVED_AREAS);
placePattern(new Array(QR_CODE_VERSION * 4).fill(1), 9, 6, 1, RESERVED_AREAS);
// Dark module
RESERVED_AREAS[SIZE - 8][8] = 1;

/**
 * @callback MaskFn
 * @param {number} row
 * @param {number} column
 */
/** @type {Array<MaskFn>} */
const MASK_FNS = [
  (row, column) => ((row + column) & 1) === 0,
  (row, _) => (row & 1) === 0,
  (_, column) => column % 3 === 0,
  (row, column) => (row + column) % 3 === 0,
  (row, column) => (((row >> 1) + Math.floor(column / 3)) & 1) === 0,
  (row, column) => ((row * column) & 1) + ((row * column) % 3) === 0,
  (row, column) => ((((row * column) & 1) + ((row * column) % 3)) & 1) === 0,
  (row, column) => ((((row + column) & 1) + ((row * column) % 3)) & 1) === 0
];
const MASKS = MASK_FNS.map(fn => RESERVED_AREAS.map((line, row) => line.map((cell, column) => (!cell && fn(row, column) ? 1 : 0))));

/**
 * Multiplies two numbers in GF(256)
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function mul(a, b) {
  return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
}
/**
 * Divides two numbers in GF(256)
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function div(a, b) {
  return EXP[(LOG[a] + LOG[b] * 254) % 255];
}

/**
 * Multiplies two polynomials in GF(256)
 * @param {Uint8Array | number[]} poly1 Array of coefficients of the first polinomial
 * @param {Uint8Array | number[]} poly2 Array of coefficients of the first polinomial
 * @returns {Uint8Array} Array of coefficients of the product polinomial
 */
function polyMul(poly1, poly2) {
  const coeffs = new Uint8Array(poly1.length + poly2.length - 1);
  for (let index = 0; index < coeffs.length; index++) {
    let coeff = 0;
    for (let p1index = 0; p1index <= index; p1index++) {
      const p2index = index - p1index;
      coeff ^= mul(poly1[p1index], poly2[p2index]);
    }
    coeffs[index] = coeff;
  }
  return coeffs;
}
/**
 * Divides two polynomials in GF(256)
 * @param {Uint8Array} dividend Array of coefficients of the first polinomial
 * @param {Uint8Array} divisor Array of coefficients of the first polinomial
 * @returns {Uint8Array} Array of coefficients of the quotient and rest polinomials
 */
function polyRest(dividend, divisor) {
  const quotientLength = dividend.length - divisor.length + 1;
  let rest = new Uint8Array(dividend);
  for (let index = 0; index < quotientLength; index++) {
    if (rest[0]) {
      const factor = div(rest[0], divisor[0]);
      const subtr = new Uint8Array(rest.length);
      subtr.set(polyMul(divisor, [factor]), 0);
      rest = rest.map((value, idx) => value ^ subtr[idx]).slice(1);
    } else {
      rest = rest.slice(1);
    }
  }
  return rest;
}

/** @type {Array<Uint8Array>} */
const EDC_POLYS = [];
// Maximum number of data codewords: 2956 for 40-L
for (let value = 0, /** @type {Uint8Array | number[]} */ lastPoly = [1]; value < 34; value++) {
  lastPoly = polyMul(lastPoly, [1, EXP[value]]);
  EDC_POLYS.push(lastPoly);
}

/**
 *
 * @param {number[]} pattern
 * @param {number} row
 * @param {number} column
 * @param {number} width
 * @param {Array<Uint8Array>} matrix
 */
function placePattern(pattern, row, column, width, matrix) {
  pattern.forEach((value, rowIndex) => {
    for (let index = width; index--; ) {
      matrix[row + rowIndex][column + index] = value & 1;
      value >>= 1;
    }
  });
}

/** @type {Array<[number, number]>} */
const MODULE_ORDER = [];
{
  let rowStep = -1;
  let row = SIZE - 1;
  let column = SIZE - 1;
  let index = 0;
  while (column >= 0) {
    if (RESERVED_AREAS[row][column] === 0) {
      MODULE_ORDER.push([row, column]);
    }
    if (index & 1) {
      row += rowStep;
      if (row === -1 || row === SIZE) {
        rowStep = -rowStep;
        row += rowStep;
        column -= column === 7 ? 2 : 1;
      } else {
        column++;
      }
    } else {
      column--;
    }
    index++;
  }
}

/**
 * Gives the highest error correction level for the given string
 * @param {string} content
 * @returns {string}
 */
function getErrorLevel(content) {
  return LIMITS.entries.find(([, maxLength]) => content.length <= maxLength)[0];
}

/**
 * Returns the sequenced data codewords for the given content
 * @param {string} content
 * @returns {Uint8Array}
 */
function getByteData(content) {
  const errorLevel = getErrorLevel(content);
  const codewords = LIMITS[errorLevel] + 2;
  const data = new Uint8Array(codewords);
  // 64 is byte mode
  data[0] = 64 + (content.length >> 4);
  data[1] = (content.length & 15) << 4;
  for (let index = 0; index < content.length; index++) {
    const byte = content.charCodeAt(index);
    data[index + 1] |= byte >> 4;
    data[index + 2] = (byte & 15) << 4;
  }
  for (let index = 0; index < codewords - content.length - 2; index++) {
    const byte = index & 1 ? 17 : 236;
    data[index + content.length + 2] = byte;
  }
  return data;
}
/**
 * Returns the EDC sequence for the given data array
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function getEDC(data) {
  const edcLen = TOTAL_CODEWORDS - data.length;
  const bigPoly = new Uint8Array(TOTAL_CODEWORDS);
  bigPoly.set(data, 0);
  return polyRest(bigPoly, EDC_POLYS[edcLen - 1]);
}

/**
 * Places the given codewords into the given matrix
 * @param {Array<Uint8Array>} matrix
 * @param {...Uint8Array} codewordLists
 */
function placeData(matrix, ...codewordLists) {
  let index = 0;
  codewordLists.forEach(bytes => {
    bytes.forEach(byte => {
      for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
        const [row, col] = MODULE_ORDER[index];
        matrix[row][col] = (byte >> bitIndex) & 1;
        index++;
      }
    });
  });
}

const FORMAT_MASK = new Uint8Array([1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]);
const FORMAT_DIVISOR = new Uint8Array([1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1]);

/**
 * Applies the mask corresponding to the given index to the matrix
 * @param {Array<Uint8Array>} matrix
 * @param {number} maskIndex
 * @param {string} level
 * @returns {Array<Uint8Array>}
 */
function applyMask(matrix, maskIndex, level) {
  const mask = MASKS[maskIndex];
  const applied = matrix.map((line, row) => line.map((cell, column) => cell ^ mask[row][column]));
  const formatPoly = new Uint8Array(15);
  const errorLevelIndex = EDC_ORDER.indexOf(level);
  formatPoly[0] = errorLevelIndex >> 1;
  formatPoly[1] = errorLevelIndex & 1;
  formatPoly[2] = maskIndex >> 2;
  formatPoly[3] = (maskIndex >> 1) & 1;
  formatPoly[4] = maskIndex & 1;
  const rest = polyRest(formatPoly, FORMAT_DIVISOR);
  formatPoly.set(rest, 5);
  const maskedFormatPoly = formatPoly.map((bit, index) => bit ^ FORMAT_MASK[index]);
  applied[8].set(maskedFormatPoly.subarray(0, 6), 0);
  applied[8].set(maskedFormatPoly.subarray(6, 8), 7);
  applied[8].set(maskedFormatPoly.subarray(7), SIZE - 8);
  applied[7][8] = maskedFormatPoly[8];
  maskedFormatPoly.subarray(0, 7).forEach((cell, index) => (applied[SIZE - index - 1][8] = cell));
  maskedFormatPoly.subarray(9).forEach((cell, index) => (applied[5 - index][8] = cell));
  return applied;
}

/**
 * Returns a column from a matrix
 * @param {Array<Uint8Array>} matrix
 * @param {number} column
 * @returns {number[]}
 */
function getColumn(matrix, column) {
  return matrix.map(line => line[column]);
}

const RULE_3_PATTERN = new Uint8Array([1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]);
const RULE_3_REVERSED_PATTERN = RULE_3_PATTERN.slice().reverse();

/**
 * Computes the reading penalty of a given matrix
 * @param {Array<Uint8Array>} matrix
 * @returns {number}
 */
function computePenalty(matrix) {
  let totalPenalty = 0;

  // Rule 1
  /**
   * Returns the penalty for a line according to the first rule of read penalties of QR codes
   * @param {Uint8Array | number[]} line
   * @returns {number}
   */
  function getLinePenalty(line) {
    let count = 0;
    let counting = 0;
    let penalty = 0;
    for (const cell of line) {
      if (cell !== counting) {
        counting = cell;
        count = 1;
      } else {
        count++;
        if (count === 5) {
          penalty += 3;
        } else if (count > 5) {
          penalty++;
        }
      }
    }
    return penalty;
  }
  const hseqs = matrix.reduce((sum, line) => sum + getLinePenalty(line), 0);
  totalPenalty += hseqs;
  const vseqs = matrix.reduce((sum, _, column) => sum + getLinePenalty(getColumn(matrix, column)), 0);
  totalPenalty += vseqs;

  // Rule 2
  let blocks = 0;
  for (let row = 0; row < SIZE - 1; row++) {
    for (let column = 0; column < SIZE - 1; column++) {
      if (
        matrix[row][column] === matrix[row][column + 1] &&
        matrix[row][column] === matrix[row + 1][column] &&
        matrix[row][column] === matrix[row + 1][column + 1]
      ) {
        blocks++;
      }
    }
  }
  totalPenalty += blocks * 3;

  // Rule 3
  let patterns = 0;
  matrix.forEach((row, index) => {
    for (let columnIndex = 0; columnIndex < SIZE - RULE_3_PATTERN.length; columnIndex++) {
      if ([RULE_3_PATTERN, RULE_3_REVERSED_PATTERN].some(ptrn => ptrn.every((cell, index) => cell === row[columnIndex + index]))) {
        patterns++;
      }
    }
    const column = getColumn(matrix, index);
    for (let rowIndex = 0; rowIndex < SIZE - RULE_3_PATTERN.length; rowIndex++) {
      if ([RULE_3_PATTERN, RULE_3_REVERSED_PATTERN].some(ptrn => ptrn.every((cell, index) => cell === column[rowIndex + index]))) {
        patterns++;
      }
    }
  });
  totalPenalty += patterns * 40;

  // Rule 4
  const litPixels = matrix.reduce((sum, line) => sum + line.reduce((lineSum, cell) => lineSum + cell, 0), 0);
  const diffPenalty = Math.floor(Math.abs((litPixels * 20) / SIZE / SIZE - 10)) * 10;
  totalPenalty += diffPenalty;

  return totalPenalty;
}

/**
 * Finds and applies the best matrix
 * @param {Array<Uint8Array>} matrix
 * @param {string} errorLevel
 * @returns
 */
function applyBestMask(matrix, errorLevel) {
  let bestAppliedMask;
  let lowestPenalty = Infinity;
  let bestMaskIndex;
  for (let maskIndex = 0; maskIndex < MASKS.length; maskIndex++) {
    const maskedMatrix = applyMask(matrix, maskIndex, errorLevel);
    const penalty = computePenalty(maskedMatrix);
    if (penalty < lowestPenalty) {
      lowestPenalty = penalty;
      bestAppliedMask = maskedMatrix;
      bestMaskIndex = maskIndex;
    }
  }
  return { matrix: bestAppliedMask, maskIndex: bestMaskIndex };
}

/**
 * Creates a QR code for the given city ID
 * @param {string} cityId
 * @returns {Array<Uint8Array>}
 */
function getQRCode(cityId) {
  if (!/^[A-Za-z\d+/]{1,19}$/.test(cityId)) {
    return null;
  }

  const content = `web+mycity://${cityId}`;
  const errorLevel = getErrorLevel(content);
  const data = getByteData(content);
  const error = getEDC(data);
  const qrCode = getNewMatrix();

  // Finder patterns
  [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7]
  ].forEach(([row, col]) => {
    placePattern([0b1111111, 0b1000001, 0b1011101, 0b1011101, 0b1011101, 0b1000001, 0b1111111], row, col, 7, qrCode);
  });
  // Alignment pattern
  placePattern([0b11111, 0b10001, 0b10101, 0b10001, 0b11111], SIZE - 9, SIZE - 9, 5, qrCode);
  // Timing patterns
  const tpLength = QR_CODE_VERSION * 4 + 1;
  placePattern([parseInt('10'.repeat(QR_CODE_VERSION * 2) + '1', 2)], 6, 8, tpLength, qrCode);
  placePattern(
    Array.from({ length: tpLength }, (_, index) => (index + 1) & 1),
    8,
    6,
    1,
    qrCode
  );
  // Dark module
  qrCode[SIZE - 8][8] = 1;

  placeData(qrCode, data, error);

  return applyBestMask(qrCode, errorLevel).matrix;
}
