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
  | 'confirmUpdate'
  | 'closeDialog';

interface MyCityMetadata {
  version: string;
  lastCity: string;
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

/**
 * Should create an element for an item of data, and attach it to the DOM tree
 */
type ElementFactory = (index: number) => HTMLElement | SVGElement;

type ElementUpdater = (element: HTMLElement | SVGElement, dataItem: any, index: number) => void;

type ListRenderer = (
  dataList: Array<any>,
  existingElements: ArrayLike<HTMLElement | SVGElement>,
  elementFactory: ElementFactory,
  elementUpdater: ElementUpdater
) => void;

type DirectionArrow = 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';

type ArrowGuard = (key: string) => key is DirectionArrow;
