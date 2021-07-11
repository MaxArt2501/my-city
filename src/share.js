// @ts-check
import { cityId } from './game.js';
import { deserializeCity } from './serialize.js';
import { getMetadata, setMetadata } from './storage.js';
import { getCityIdFromURI, getCityURI, renderForList } from './utils.js';

/** @type {Worker} */
let qrCodeWorker;
/** @type {SVGSVGElement} */
const qrCodeRoot = document.querySelector('#qrCode');
/** @type {HTMLDialogElement} */
const shareDialog = document.querySelector('#share');

export function showQRCode() {
  qrCodeRoot.innerHTML = '';
  if (!qrCodeWorker) {
    qrCodeWorker = new Worker('./qr-code.js');
  }
  qrCodeWorker.addEventListener(
    'message',
    /** @param {MessageEvent<QRCodeData>} event */ event => {
      const qrCode = event.data.qrCode;
      const darkModules = qrCode.flatMap((line, row) =>
        Array.from(line).reduce((darkList, cell, column) => {
          if (cell) {
            darkList.push([row, column]);
          }
          return darkList;
        }, [])
      );
      qrCodeRoot.setAttribute('viewBox', `0 0 ${qrCode.length} ${qrCode.length}`);
      renderForList(
        darkModules,
        [],
        () => qrCodeRoot.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect')),
        (rect, [row, column]) => {
          rect.setAttribute('x', column);
          rect.setAttribute('y', row);
        }
      );
    },
    { once: true }
  );
  qrCodeWorker.postMessage(cityId);
  const link = getCityURI(cityId);
  Object.assign(shareDialog.querySelector('a'), { href: link, textContent: link });
}

/** @type {HTMLDialogElement} */
const scanDialog = document.querySelector('#scan');
const video = document.querySelector('video');
/** @type {HTMLParagraphElement} */
const allowWarning = scanDialog.querySelector('#allowCamera');
/** @type {HTMLDivElement} */
const resultSection = scanDialog.querySelector('#foundCity');
const scanFooter = scanDialog.querySelector('footer');
const resultLink = scanFooter.querySelector('a');
/** @type {HTMLButtonElement} */
const changeCameraBtn = scanFooter.querySelector('button[data-action="changeCamera"]');
/** @type {HTMLButtonElement} */
const retryBtn = scanFooter.querySelector('button[data-action="retryScan"]');
/** @type {number} */
let scanPollingIntervalId;

scanDialog.addEventListener('close', streamDispose);
resultLink.addEventListener('click', () => {
  scanDialog.close();
});

const detector = window.BarcodeDetector && new BarcodeDetector({ formats: ['qr_code'] });
/** @type {MediaDeviceInfo[]} */
let cameras;
/** @type {string} */
let currentDeviceId;

function streamDispose() {
  const stream = video.srcObject;
  if (stream && 'getTracks' in stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    clearInterval(scanPollingIntervalId);
  }
}

function getNextCameraId() {
  return cameras[(cameras.findIndex(cam => cam.deviceId === currentDeviceId) + 1) % cameras.length].deviceId;
}

/**
 * Requests and initialize the device with the given id
 * @param {string} [deviceId]
 * @returns {Promise<MediaStream>}
 */
export async function initializeCamera(deviceId) {
  if (!deviceId || !cameras.find(cam => cam.deviceId === deviceId)) {
    deviceId = getNextCameraId();
  }
  streamDispose();
  const camera = await navigator.mediaDevices.getUserMedia({ video: { deviceId } });
  currentDeviceId = deviceId;
  setMetadata(deviceId, 'lastCameraId');
  const [track] = camera.getVideoTracks();
  const { aspectRatio } = track.getSettings();
  video.style.height = `${video.clientWidth / aspectRatio}px`;
  video.srcObject = camera;
  startScan();
  return camera;
}

export function startScan() {
  [resultSection, resultLink, retryBtn].forEach(el => (el.hidden = true));
  changeCameraBtn.hidden = cameras.length < 2;

  video.play();
  const setupPolling = () => {
    scanPollingIntervalId = setInterval(async () => {
      const [detected] = await detector.detect(video);
      if (detected) {
        const cityId = getCityIdFromURI(detected.rawValue);
        if (cityId) {
          clearInterval(scanPollingIntervalId);
          video.pause();
          [resultSection, resultLink, retryBtn].forEach(el => (el.hidden = false));
          changeCameraBtn.hidden = true;
          resultLink.href = `#${cityId}`;
          const city = deserializeCity(cityId);
          resultSection.querySelector('output').textContent = `${cityId} (${city.width}×${city.height})`;
        }
      }
    }, 1000);
  };
  if (video.srcObject && video.currentTime > 0) {
    setupPolling();
  } else {
    video.addEventListener('canplay', setupPolling, { once: true });
  }
}

export async function scanQRCode() {
  scanDialog.showModal();

  if (!cameras) {
    try {
      cameras = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error(error, error.trace);
      scanDialog.close();
      return;
    }
  }

  changeCameraBtn.hidden = cameras.length < 2;
  try {
    await initializeCamera(currentDeviceId || (await getMetadata('lastCameraId')));
  } catch (error) {
    console.error(error, error.trace);
    scanDialog.close();
    return;
  }

  allowWarning.hidden = true;
}
