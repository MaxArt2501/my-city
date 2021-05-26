// @ts-check
import { VERSION } from './my-city.js';

/** @type {Promise.<IDBDatabase>} */
export const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('MyCity');
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', reject, { once: true });
  request.addEventListener('upgradeneeded', e => {
    const db = request.result;
    db.createObjectStore('cities', { keyPath: 'id' });
    const mdStore = db.createObjectStore('metadata');
    mdStore.add(VERSION, 'version');
  });
});

/**
 * Creates a request on a store with the given factory and awaits for its
 * completion or error
 * @param {StoreName} storeName
 * @param {(store: IDBObjectStore) => IDBRequest} requestFactory
 * @param {IDBTransactionMode} [mode='readonly']
 * @returns {Promise}
 */
function performOnStore(storeName, requestFactory, mode = 'readonly') {
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    const store = db.transaction([storeName], mode).objectStore(storeName);
    const request = requestFactory(store);
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', reject, { once: true });
  });
}

/**
 * Returns the value corresponding to a key from an object store
 * @param {StoreName} storeName
 * @param {string} key
 * @returns {Promise}
 */
function getFromDB(storeName, key) {
  return performOnStore(storeName, store => store.get(key));
}

/**
 * Returns the value of the requested metadata
 * @param {StoreName} storeName
 * @param {*} value
 * @param {string} [key]
 * @returns {Promise}
 */
function setToDB(storeName, value, key) {
  return performOnStore(storeName, store => store.put(value, key), 'readwrite');
}

/**
 * Returns the value of the requested metadata
 * @type {<T extends keyof MyCityMetadata>(key: T) => Promise<MyCityMetadata[T]>}
 */
export const getMetadata = getFromDB.bind(null, 'metadata');

/**
 * Returns the value of the requested metadata
 * @type {<T extends keyof MyCityMetadata>(value: string, key: T) => Promise}
 */
export const setMetadata = setToDB.bind(null, 'metadata');

/**
 * Returns the city data
 * @type {(cityId: string) => Promise<CityData>}
 */
export const getCityData = getFromDB.bind(null, 'cities');

/**
 * Patches the data of a city in store
 * @param {string} cityId
 * @param {Partial<CityData>} data
 * @returns {Promise}
 */
export async function updateCityData(cityId, data) {
  const existingCity = await getCityData(cityId);
  /** @type {CityData} */
  const newCity = { ...existingCity, ...data };
  return setToDB('cities', newCity);
}

/**
 * Returns all the cities in the store
 * @returns {Promise<CityData[]>}
 */
export function getAllCities() {
  return performOnStore('cities', store => store.getAll());
}

/**
 * Returns all the id's of the cities in store
 * @returns {Promise<string[]>}
 */
export function getAllCityIds() {
  return performOnStore('cities', store => store.getAllKeys());
}

/**
 * Saves a bunch of cities to store
 * @param {CityData[]} cities
 */
export function batchSaveCities(cities) {
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    const xaction = db.transaction(['cities'], 'readwrite');
    const store = xaction.objectStore('cities');
    cities.forEach(city => store.put(city));
    xaction.addEventListener('complete', () => resolve(), { once: true });
    xaction.addEventListener('error', reject, { once: true });
  });
}

/**
 * Insert a list of cities in storage if they're missing
 * @param {string[]} ids
 * @returns {Promise}
 */
export async function addMissingCities(ids) {
  const inStore = await getAllCityIds();
  const added = new Date().toISOString();
  return batchSaveCities(ids.filter(id => !inStore.includes(id)).map(id => ({ id, attempts: [], history: [], lastPlayed: null, added })));
}
