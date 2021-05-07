interface City {
  width: number;
  height: number;
  borderHints: number[][];
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

type InputMode = 'mixed' | 'pointer' | 'keyboard';
interface InputModule {
  readonly mode: InputMode;
  initialize(): void;
  terminate(): void;
}

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
type ElementFactory = (index: number) => HTMLElement;

type ElementUpdater<T> = (element: HTMLElement, dataItem: T, index: number) => void;

type ListRenderer = <T>(
  dataList: Array<T>,
  existingElements: ArrayLike<HTMLElement>,
  elementFactory: ElementFactory,
  elementUpdater: ElementUpdater<T>
) => void;

type DirectionArrow = 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';

type ArrowGuard = (key: string) => key is DirectionArrow;
