/**
 * Retrieves the city's historic data from storage
 * @param {string} cityId
 * @returns {CityHistory}
 */
export function getCityHistory(cityId) {
  try {
    return JSON.parse(localStorage[cityId]);
  } catch (error) {
    console.error(`Found invalid history for city with ID '${cityId}'`);
    console.error(error);
  }
}

/**
 * Saves the city's historic data to storage
 * @param {string} cityId
 * @param {CityHistory} history
 */
export function saveCityHistory(cityId, history) {
  localStorage[cityId] = JSON.stringify(history);
}

/**
 * Returns whether a city exists in the storage
 * @param {string} cityId
 * @returns {boolean}
 */
export function cityExists(cityId) {
  return cityId in localStorage;
}

/**
 * Loads the history of a game, given the ID of the city
 * @param {string} cityId
 * @returns {CityHistory}
 */
export function loadHistory(cityId) {
  return (cityExists(cityId) && getCityHistory(cityId)) || { history: [], attempts: [] };
}
