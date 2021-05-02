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
 * @param {InputMode} mode
 * @returns {Promise<InputModule>}
 */
async function setInputMode(mode) {
  if (currentInputModule) {
    currentInputModule.terminate();
  }
  /** @type {InputModule} */
  const inputModule = await import(`./${mode}-input.js`);
  inputModule.initialize();
  document.body.dataset.inputMode = 'mixed';
  return (currentInputModule = inputModule);
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

  setInputMode('mixed');
}

/** @type {InputModule} */
let currentInputModule;

/** @type {InputMode[]} */
const inputModes = ['mixed'];
document.addEventListener('keypress', ({ key }) => {
  if (key.toLowerCase() === 'i') {
    const inputModeIndex = inputModes.indexOf(currentInputModule.mode);
    setInputMode(inputModes[(inputModeIndex + 1) % inputModes.length]);
  }
});

main();
