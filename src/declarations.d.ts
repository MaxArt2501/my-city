type BorderHints = [number[], number[], number[], number[]];

interface City {
  width: number;
  height: number;
  borderHints: BorderHints;
}
interface GameError {
  type: string;
  message: string;
  index: number;
}
interface StairsRanges {
  start: number[];
  end: number[];
}
interface State {
  buildings: number[][];
  marks: Set<number>[][];
}

interface CityData {
  id: string;
  added: string;
  lastPlayed: string;
  history: string[];
  attempts: string[];
  difficulty: number;
}

type GameAction =
  | 'help'
  | 'export'
  | 'import'
  | 'wipe'
  | 'confirmWipe'
  | 'settings'
  | 'about'
  | 'restart'
  | 'undo'
  | 'redo'
  | 'confirmRestart'
  | 'hint'
  | 'fillMarks'
  | 'solve'
  | 'toggleGameMode'
  | 'toggleSidebar'
  | 'update'
  | 'share'
  | 'scan'
  | 'retryScan'
  | 'changeCamera'
  | 'confirmUpdate'
  | 'closeDialog';

interface MyCityMetadata {
  version: string;
  lastCity: string;
  lastCameraId: string;
}

interface MyCityDatabase {
  metadata: MyCityMetadata;
  cities: Record<string, CityData>;
}

type StoreName = keyof MyCityDatabase;

interface ExportData {
  version: string;
  date: string;
  cities: CityData[];
}

type ImportMode = 'merge' | 'replace' | 'cities';

interface QRCodeData {
  cityId: string;
  qrCode: Uint16Array[];
}

/*
 * Reasonable overrides for DOM definitions
 */
interface Document {
  readonly activeElement: HTMLElement | null;
}
interface DocumentFragment {
  cloneNode(deep?: boolean): DocumentFragment;
}
interface HTMLElement {
  readonly children: HTMLCollectionOf<HTMLElement>;
}
interface KeyboardEvent {
  readonly target: HTMLElement | null;
}
interface MouseEvent {
  readonly target: HTMLElement | null;
}

interface Point2D {
  x: number;
  y: number;
}

type BarcodeFormat =
  | 'aztec'
  | 'code_128'
  | 'code_39'
  | 'code_93'
  | 'codabar'
  | 'data_matrix'
  | 'ean_13'
  | 'ean_8'
  | 'itf'
  | 'pdf417'
  | 'qr_code'
  | 'unknown'
  | 'upc_a'
  | 'upc_e';

interface DetectedBarcode {
  boundingBox: DOMRectReadOnly;
  rawValue: string;
  format: BarcodeFormat;
  cornerPoints: Array<Point2D>;
}

interface BarcodeDetectorOptions {
  formats: BarcodeFormat[];
}
interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<DetectedBarcode>>;
}

declare var BarcodeDetector: {
  prototype: BarcodeDetector;
  new (barcodeDetectorOptions?: BarcodeDetectorOptions): BarcodeDetector;
  getSupportedFormats(): Promise<BarcodeFormat[]>;
};

// Due to TypeScript 4.4's absurd crippling and deprecation of HTMLDialogElement
interface HTMLDialogElement extends HTMLElement {
  open: boolean;
  returnValue: string;
  close(returnValue?: string): void;
  show(): void;
  showModal(): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLDialogElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var HTMLDialogElement: {
  prototype: HTMLDialogElement;
  new (): HTMLDialogElement;
};
