// @ts-check
import {
  initializeCity,
  isCityComplete,
  leaveCity,
  renderCity,
  restartGame,
  startClock,
  stopClock,
  toggleMode,
  travelHistory
} from './game.js';
import { deserializeCity, serializeCity } from './serialize.js';
import { formatElapsed, getAttemptElapsed, isAttemptSuccessful, toISODuration } from './utils.js';

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
 * @returns {CityHistory}
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
  return { history: [], attempts: [] };
}

/** @type {HTMLUListElement} */
const cityList = document.querySelector('nav ul');
/** @type {HTMLTemplateElement} */
const template = document.querySelector('#cityTemplate');

function checkLocationHash() {
  const hash = location.hash.slice(1).replace(/=/g, '');
  if (hash) {
    try {
      const city = deserializeCity(hash);
      initializeCity(city, loadHistory(hash));
      document.body.dataset.currentCity = hash;
      cityList.textContent = '';
      return;
    } catch (e) {
      console.error('Invalid city ID');
      location.href = '#';
    }
  }
  delete document.body.dataset.currentCity;
  leaveCity();
  showCityList();
}

async function showCityList() {
  const cities = await loadCities();
  const list = document.createDocumentFragment();
  for (const city of cities) {
    const item = template.content.cloneNode(true);
    item.querySelector('span').textContent = `${city.width}×${city.height}`;

    const time = item.querySelector('time');
    const cityId = serializeCity(city);
    const { attempts } = loadHistory(cityId);
    attempts.sort();
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt) {
      time.textContent = '--:--';
      time.dateTime = '';
    } else if (isAttemptSuccessful(lastAttempt)) {
      // The last attempt has been successful - look for the best time
      const best = Math.min(...attempts.filter(isAttemptSuccessful).map(getAttemptElapsed));
      time.textContent = formatElapsed(best);
      time.dateTime = toISODuration(best);
    } else {
      const current = getAttemptElapsed(lastAttempt);
      time.classList.add('current');
      time.textContent = formatElapsed(current);
      time.dateTime = toISODuration(current);
    }

    renderCity(item.querySelector('section'), city);
    item.querySelector('a').href = `#${serializeCity(city)}`;
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

window.addEventListener('beforeunload', leaveCity);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopClock();
  } else if (!document.querySelector('dialog[open]')) {
    startClock();
  }
});

document.addEventListener('click', ({ target }) => {
  /** @type {HTMLButtonElement} */
  const actionButton = target.closest('button[data-action]');
  if (actionButton) {
    handleAction(actionButton);
  }
});

document.addEventListener(
  'close',
  () => {
    if (document.body.dataset.currentCity) {
      const openDialogs = document.querySelectorAll('dialog[open]');
      if (openDialogs.length === 0) {
        startClock();
      }
    }
  },
  { capture: true }
);

/** @type {Object.<string, HTMLDialogElement>} */
const dialogs = ['sidebar', 'restartConfirm', 'help', 'about'].reduce(
  (dialogMap, id) => Object.assign(dialogMap, { [id]: document.querySelector(`#${id}`) }),
  {}
);

/**
 * Handles actions from the sidebar menu
 * @param {HTMLButtonElement} button
 */
function handleAction(button) {
  const action = button.dataset.action;
  switch (action) {
    case 'help':
      dialogs.help.showModal();
      break;
    case 'about':
      dialogs.about.showModal();
      break;
    case 'restart':
      if (isCityComplete()) {
        restartGame();
        dialogs.sidebar.close();
      } else {
        dialogs.restartConfirm.showModal();
      }
      break;
    case 'confirmRestart':
      dialogs.restartConfirm.close();
      dialogs.sidebar.close();
      restartGame();
      break;
    case 'undo':
      travelHistory(1);
      break;
    case 'redo':
      travelHistory(-1);
      break;
    case 'switchInputMode':
      switchInputMode();
      break;
    case 'toggleGameMode':
      toggleMode();
      break;
    case 'toggleSidebar':
      if (dialogs.sidebar.open) {
        dialogs.sidebar.close();
      } else {
        dialogs.sidebar.showModal();
        if (document.body.dataset.currentCity) {
          stopClock();
        }
      }
      break;
    case 'closeDialog':
      const dialog = button.closest('dialog');
      dialog?.close();
  }
}

function switchInputMode() {
  const inputModeIndex = inputModes.indexOf(currentInputModule.mode);
  setInputMode(inputModes[(inputModeIndex + 1) % inputModes.length]);
}

main();
