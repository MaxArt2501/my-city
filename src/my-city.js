// @ts-check
import { initializeCity, renderCity, toggleMode, travelHistory } from './game.js';
import { base64ToUtf8, deserializeCity, serializeCity, utf8ToBase64 } from './serialize.js';

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
  document.body.dataset.inputMode = mode;
  return (currentInputModule = inputModule);
}

/**
 * Loads the history of a game, given the ID of the city
 * @param {string} cityId
 * @returns {string[]}
 */
function loadHistory(cityId) {
  if (localStorage[cityId]) {
    try {
      return JSON.parse(localStorage[cityId]);
    } catch (error) {
      console.error(`Found invalid history for city with ID '${cityId}'`);
      console.error(error);
    }
  }
  return [];
}

/** @type {HTMLUListElement} */
const cityList = document.querySelector('nav ul');
/** @type {HTMLTemplateElement} */
const template = document.querySelector('#cityTemplate');

function checkLocationHash() {
  const hash = location.hash.slice(1).replace(/=/g, '');
  if (hash) {
    try {
      const city = deserializeCity(base64ToUtf8(hash));
      initializeCity(city, loadHistory(hash));
      document.body.dataset.currentCity = hash;
      cityList.textContent = '';
      return;
    } catch {
      console.error('Invalid city ID');
      location.href = '#';
    }
  }
  document.body.dataset.currentCity = '';
  showCityList();
}

async function showCityList() {
  const cities = await loadCities();
  const list = document.createDocumentFragment();
  for (const city of cities) {
    const item = template.content.cloneNode(true);
    item.querySelector('span').textContent = `${city.width}×${city.height}`;
    const time = item.querySelector('time');
    time.textContent = '--:--';
    renderCity(item.querySelector('section'), city);
    item.querySelector('a').href = `#${utf8ToBase64(serializeCity(city))}`;
    list.appendChild(item);
  }
  cityList.appendChild(list);
}

function main() {
  checkLocationHash();
  setInputMode('mixed');
}

/** @type {InputModule} */
let currentInputModule;

/** @type {InputMode[]} */
const inputModes = ['mixed', 'pointer', 'keyboard'];
document.addEventListener('keypress', ({ key }) => {
  if (key.toLowerCase() === 'i') {
    switchInputMode();
  } else if (key.toLowerCase() === 'm') {
    toggleMode();
  }
});

window.addEventListener('hashchange', checkLocationHash);

/**
 * @type {Object.<string, HTMLButtonElement>}
 */
export const buttons = {
  inputMode: document.querySelector('#inputMode'),
  gameMode: document.querySelector('button.mode'),
  undo: document.querySelector('#undo'),
  redo: document.querySelector('#redo')
};
buttons.inputMode.addEventListener('click', switchInputMode);
buttons.gameMode.addEventListener('click', () => toggleMode());
buttons.undo.addEventListener('click', () => travelHistory(1));
buttons.redo.addEventListener('click', () => travelHistory(-1));

function switchInputMode() {
  const inputModeIndex = inputModes.indexOf(currentInputModule.mode);
  setInputMode(inputModes[(inputModeIndex + 1) % inputModes.length]);
}

main();
