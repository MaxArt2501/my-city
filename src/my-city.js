// @ts-check
import { initializeCity, leaveCity, renderCity, startClock, stopClock } from './game.js';
import { initializeInput } from './input.js';
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
  initializeInput();
}

window.addEventListener('hashchange', checkLocationHash);

window.addEventListener('beforeunload', leaveCity);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopClock();
  } else if (!document.querySelector('dialog[open]')) {
    startClock();
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

main();
