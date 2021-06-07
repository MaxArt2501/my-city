// @ts-check
import { importData, parseImportData, verifyImportData } from './data-manager.js';
import { initializeCity, leaveCity, renderCity, startClock, stopClock } from './game.js';
import { dialogs, initializeInput } from './input.js';
import { deserializeCity, serializeCity } from './serialize.js';
import { addMissingCities, batchSaveCities, getAllCities, getCityData } from './storage.js';
import { computeCityDifficulty, formatElapsed, formatSize, getAttemptElapsed, isAttemptSuccessful, toISODuration } from './utils.js';

export const VERSION = '0.1.1';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(location.pathname + 'sw.js', { scope: location.pathname });
}

/**
 * Load a JSON file of cities
 * @param {string} path
 * @returns {Promise<City[]>}
 */
async function loadCities(path = './cities.json') {
  const response = await fetch(path);
  return response.json();
}

/** @type {HTMLUListElement} */
const cityList = document.querySelector('nav ul');
/** @type {HTMLTemplateElement} */
const template = document.querySelector('#cityTemplate');

async function checkLocationHash() {
  const hash = location.hash.slice(1).replace(/=/g, '');
  if (hash) {
    try {
      const city = deserializeCity(hash);
      addMissingCities([hash]);
      initializeCity(city, await getCityData(hash));
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
  const cities = await getAllCities();
  const list = document.createDocumentFragment();
  /** @type {CityData[]} */
  const updatingCities = [];
  for (const cityData of cities) {
    const city = deserializeCity(cityData.id);
    const item = template.content.cloneNode(true);
    let { difficulty } = cityData;
    if (typeof cityData.difficulty !== 'number') {
      difficulty = computeCityDifficulty(city);
      updatingCities.push({ ...cityData, difficulty });
    }
    item.querySelector('meter').value = difficulty;

    const time = item.querySelector('time');
    const attempts = cityData.attempts.slice().sort();
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
    item.querySelector('a').href = `#${cityData.id}`;
    list.appendChild(item);
  }
  while (cityList.lastChild) {
    cityList.lastChild.remove();
  }
  cityList.appendChild(list);
  if (updatingCities.length > 0) {
    batchSaveCities(updatingCities);
  }
}

/** @type {HTMLFormElement} */
const importForm = document.querySelector('#importForm');
/** @type {HTMLDivElement} */
const importInfo = document.querySelector('#importInfo');
/** @type {HTMLInputElement} */
const dataFile = document.querySelector('#dataFile');

/** @type {ExportData} */
let currentImportData;

/**
 * @param {File} file
 */
async function previewImportData(file) {
  const data = await parseImportData(file);
  const error = verifyImportData(data);
  importInfo.classList.toggle('error', !!error);
  importInfo.innerHTML =
    error ||
    `${data.cities.length} ${data.cities.length === 1 ? 'city' : 'cities'} on <time datetime=${data.date}>${new Date(
      data.date
    ).toLocaleDateString()}</time>, ${formatSize(file.size)}`;
  dataFile.setCustomValidity(error || '');
}

async function main() {
  const cityIds = (await loadCities()).map(serializeCity);
  await addMissingCities(cityIds);
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

// @ts-ignore
dataFile.addEventListener('change', event => previewImportData(event.target.files[0]));

importForm.addEventListener('submit', async event => {
  event.preventDefault();
  // @ts-ignore
  const mode = importForm.elements.importMode.value;
  await importData(await parseImportData(dataFile.files[0]), mode);
  dialogs.import.close();
  dialogs.sidebar.close();
  showCityList();
});
dialogs.import.addEventListener('close', () => {
  currentImportData = undefined;
  importInfo.textContent = '';
  importInfo.classList.remove('error');
  dataFile.form.reset();
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
