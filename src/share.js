// @ts-check
import { cityId } from './game.js';
import { deserializeCity } from './serialize.js';
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
/** @type {number} */
let scanPollingIntervalId;

scanDialog.addEventListener('close', () => {
  const mediaSource = video.srcObject;
  if (mediaSource && 'getTracks' in mediaSource) {
    mediaSource.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    clearInterval(scanPollingIntervalId);
  }
});
resultLink.addEventListener('click', () => {
  scanDialog.close();
});

const detector = window.BarcodeDetector && new BarcodeDetector({ formats: ['qr_code'] });

export function startScan() {
  resultSection.hidden = true;
  scanFooter.hidden = true;

  video.play();
  const setupPolling = () => {
    scanPollingIntervalId = setInterval(async () => {
      const [detected] = await detector.detect(video);
      if (detected) {
        const cityId = getCityIdFromURI(detected.rawValue);
        if (cityId) {
          clearInterval(scanPollingIntervalId);
          video.pause();
          resultSection.hidden = false;
          scanFooter.hidden = false;
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

  /** @type {MediaStream} */
  let cam;
  try {
    cam = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (error) {
    console.error(error, error.trace);
    scanDialog.close();
    return;
  }

  allowWarning.hidden = true;
  const [track] = cam.getVideoTracks();
  const { aspectRatio } = track.getSettings();
  video.style.height = `${video.clientWidth / aspectRatio}px`;
  video.srcObject = cam;

  startScan();
}
