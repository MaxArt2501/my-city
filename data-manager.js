// @ts-check
import { VERSION } from './my-city.js';
import { addMissingCities, dbPromise, getAllCities } from './storage.js';
import { getAttemptElapsed, isAttemptSuccessful, isValidAttempt, toISODuration } from './utils.js';

export async function exportData() {
  const cities = await getAllCities();
  /** @type {ExportData} */
  const data = {
    version: VERSION,
    date: new Date().toISOString(),
    cities
  };

  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `my-city-${data.date.replace(/:/g, '-').replace(/\./g, "'")}.json`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Merges the imported cities with the existing ones
 * @param {CityData[]} incoming
 */
async function mergeCities(incoming) {
  const timestamp = new Date().toISOString();
  const existing = await getAllCities();
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    const xaction = db.transaction(['cities'], 'readwrite');
    const store = xaction.objectStore('cities');
    for (const cityData of incoming) {
      const localData = existing.find(({ id }) => id === cityData.id);
      if (localData) {
        const importPlayedLast = +new Date(cityData.lastPlayed) > +new Date(localData.lastPlayed);
        const added = new Date(
          +new Date(cityData.added) < +new Date(localData.added) ? cityData.added : localData.added || timestamp
        ).toISOString();
        const lastPlayed = new Date(importPlayedLast ? cityData.lastPlayed : localData.lastPlayed).toISOString();
        const history = importPlayedLast ? cityData.history : localData.history;

        const attemptMap = [...cityData.attempts, ...localData.attempts].sort().reduce((map, attempt) => {
          const timestamp = attempt.slice(0, attempt.indexOf(' '));
          const successful = isAttemptSuccessful(attempt);
          const elapsed = getAttemptElapsed(attempt);
          if (
            !(timestamp in map) ||
            (successful && !map[timestamp].successful) ||
            (successful === map[timestamp].successful && elapsed < map[timestamp].elapsed)
          ) {
            map[timestamp] = { elapsed, successful };
          }
          return map;
        }, {});
        const attempts = Object.entries(attemptMap).map(
          ([timestamp, { elapsed, successful }]) => `${timestamp} ${toISODuration(elapsed)}${successful ? '*' : ''}`
        );
        store.put({ id: cityData.id, added, lastPlayed, history, attempts });
      } else {
        store.put({ ...cityData, added: cityData.added || timestamp });
      }
    }
    xaction.addEventListener('complete', resolve, { once: true });
    xaction.addEventListener('error', reject, { once: true });
  });
}

/**
 * Replaces the current store data with the imported data
 * @param {CityData[]} incoming
 */
async function replaceCities(incoming) {
  const timestamp = new Date().toISOString();
  const existing = await getAllCities();
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    const xaction = db.transaction(['cities'], 'readwrite');
    const store = xaction.objectStore('cities');
    incoming.forEach(cityData => store.put({ ...cityData, added: cityData.added || timestamp }));
    const incomingIds = incoming.map(({ id }) => id);
    existing.forEach(({ id }) => {
      if (!incomingIds.includes(id)) {
        store.delete(id);
      }
    });
    xaction.addEventListener('complete', resolve, { once: true });
    xaction.addEventListener('error', reject, { once: true });
  });
}

/**
 * Adds only the cities missing in the local store
 * @param {CityData[]} incoming
 */
function addCitiesOnly(incoming) {
  const incomingIds = incoming.map(({ id }) => id);
  return addMissingCities(incomingIds);
}

/** @type {Record<ImportMode, (incoming: CityData[]) => Promise>} */
const importFnMap = {
  merge: mergeCities,
  replace: replaceCities,
  cities: addCitiesOnly
};

/**
 * Imports the given data with the specified import mode.
 * @param {ExportData} data
 * @param {ImportMode} mode The import mode. Could be one of the following:
 *                          * `'merge'` - imports all the data: new cities are
 *                            added, attempt lists are merged;
 *                          * `'replace'` - completely replace the existing
 *                            data, wiping all the current local games;
 *                          * `'cities'` - import just the cities that are not
 *                            present locally, without their historic data.
 * @returns {Promise}
 */
export function importData(data, mode) {
  return importFnMap[mode](data.cities);
}

/**
 * Parses the data in the given file
 * @param {File} file
 * @returns {Promise<ExportData>}
 */
export function parseImportData(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.addEventListener(
      'load',
      event => {
        try {
          // @ts-ignore
          resolve(JSON.parse(event.target.result));
          // TODO: should check the validity of this file
        } catch (error) {
          reject(error);
        }
      },
      { once: true }
    );
    fileReader.readAsText(file);
  });
}

/**
 * Checks if the argument is a valid city
 * @param {*} city
 * @returns {city is CityData}
 */
function isValidCity(city) {
  if (!city || typeof city !== 'object' || typeof city.id !== 'string') {
    return false;
  }
  if (
    !Array.isArray(city.attempts) ||
    !city.attempts.every(isValidAttempt) ||
    !Array.isArray(city.history) ||
    city.history.some(state => typeof state !== 'string')
  ) {
    return false;
  }
  return true;
}

/**
 * Returns a string containing an error if the argument isn't valid import data,
 * null otherwise
 * @param {*} data
 * @returns {?string}
 */
export function verifyImportData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.cities)) {
    return 'Invalid import data';
  }
  return data.cities.every(isValidCity) ? null : 'Invalid city list';
}
