// @ts-check
import { initializeCity } from './game.js';
import { deserializeCity } from './serialize.js';

/**
 * Load a JSON file of cities
 * @param {string} path
 * @returns {Promise<City[]>}
 */
async function loadCities(path = './cities.json') {
  const response = await fetch(path);
  return await response.json();
}

/**
 * Loads an input mode
 * @param {string} mode
 * @returns {Promise}
 */
function getInputMode(mode) {
  return import(`./${mode}-input.js`);
}

async function main() {
  const lastCityId = localStorage['.lastCity'];
  if (lastCityId) {
    const city = deserializeCity(atob(lastCityId));
    /** @type {string[]} */
    let history = [];
    if (localStorage[lastCityId]) {
      try {
        history = JSON.parse(localStorage[lastCityId]);
      } catch (error) {
        console.error(`Found invalid history for city with ID '${lastCityId}'`);
        console.error(error);
      }
    }
    initializeCity(city, history);
  } else {
    const cities = await loadCities();
    initializeCity(cities[0], []);
  }

  const inputMode = await import('./mixed-input.js');
  inputMode.initialize();
}

main();
