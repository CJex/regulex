/**
Caution: TypeScript enum is compatible with number!

By convention, we'd better to relax the comparison to only compare Ordering with zero.
Ordering > 0 ==> GT; Ordering < 0 ==> LT;
*/
export const enum Ordering {
  LT = -1,
  EQ = 0,
  GT = 1
}

export type Maybe<T> = T | undefined;

export interface Eq<A> {
  equals: (x: A, y: A) => boolean;
}

export interface Comparator<A> {
  (x: A, y: A): Ordering;
}

/**
Usage: function f<S extends Stream<S[0]>>(s:S):S {return s}
*/
export interface Stream<S> {
  readonly [index: number]: S;
  length: number;
  slice(): Stream<S>;
  slice(start: number): Stream<S>;
  slice(start: number, end: number): Stream<S>;
}

export function compare<T>(a: T, b: T): Ordering {
  if (a > b) return Ordering.GT;
  if (a < b) return Ordering.LT;
  return Ordering.EQ;
}

export function compareArray<T>(a1: Stream<T>, a2: Stream<T>, cmp: Comparator<T> = compare): Ordering {
  let l1 = a1.length;
  let l2 = a2.length;
  if (!l1 && !l2) return Ordering.EQ;

  for (let i = 0, l = Math.min(l1, l2); i < l; i++) {
    let ord = cmp(a1[i], a2[i]);
    if (ord !== Ordering.EQ) return ord;
  }
  return compare(l1, l2);
}

/**
Support custom equals method via Eq<T> interface
*/
export function deepEqual<T>(a: T, b: T): boolean {
  if (typeof a !== 'object' || a == null) {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    let l1 = a.length;
    let l2 = b.length;
    if (l1 !== l2) return false;
    for (let i = 0; i < l1; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
  } else if (typeof (<any>a).equals === 'function') {
    return (<any>a).equals(b);
  } else {
    for (let k in a) {
      if (!deepEqual(a[k], b[k])) return false;
    }
  }
  return true;
}

export const _inspect_ = Symbol.for('nodejs.util.inspect.custom');

/**
Compare unicode string by their code points
string.fromCodePoint(0x1F437) == "🐷" == "\uD83D\uDC37" == "\u{1F437}"
let c1 = '\uD83D\uDC37';
let c2 = '\uFA16';
assert(compareFullUnicode(c1,c2) === Ordering.GT)
*/
export function compareFullUnicode(s1: string, s2: string): Ordering {
  let a1 = Array.from(s1).map(Char.ord);
  let a2 = Array.from(s2).map(Char.ord);
  return compareArray(a1, a2);
}

export type BSearchResult = {found: boolean; index: number};
/** Binary Search
All items greater than `x` are behind BSearchResult.index
When `x` lesser than all elements, result index will be startIndex-1.
@param cmp { (x,elementInArray) => Ordering }
@param startIndex {}
*/
export function bsearch<T>(a: T[], x: T, cmp?: Comparator<T>, startIndex?: number, endIndex?: number): BSearchResult;
export function bsearch<T, X>(
  a: T[],
  x: X,
  cmp: (x: X, e: T) => Ordering,
  startIndex?: number,
  endIndex?: number
): BSearchResult;
export function bsearch<T>(
  a: T[],
  x: T,
  cmp: Comparator<T> = compare,
  startIndex: number = 0,
  endIndex: number = a.length - 1
): BSearchResult {
  let result = {found: false, index: -1};
  let i = startIndex - 1;
  for (let lo = startIndex, hi = endIndex; lo <= hi; ) {
    i = lo + ((hi - lo + 1) >> 1);
    let middle = a[i];
    let ord = cmp(x, middle);
    if (ord < 0) {
      // LT
      hi = --i;
    } else if (ord > 0) {
      // GT
      lo = i + 1;
    } else {
      // EQ
      result.found = true;
      break;
    }
  }

  result.index = i;
  return result;
}

/**
Return sorted unique Array.
*/
export function sortUnique<T>(a: T[], cmp: Comparator<T> = compare): T[] {
  let n = a.length;
  if (n <= 1) return a;
  a = a.slice().sort(cmp);

  let len = 1;
  for (let i = 1, last = a[0]; i < n; i++) {
    let x = a[i];
    if (x === last || cmp(x, last) === Ordering.EQ) continue;
    last = a[len++] = a[i];
  }
  a.length = len;
  return a;
}

// chr(0x1F4AA) == "💪"  == "\uD83D\uDCAA"
function chr(n: number): string {
  return String.fromCodePoint(n);
}

function ord(c: string): number {
  return c.codePointAt(0)!;
}

const CHAR_MAX_CODE_POINT = 0x10ffff;
export const Char = {
  chr: chr,
  ord: ord,
  pred(c: string): string {
    return chr(ord(c) - 1);
  },
  predSafe(c: string): string {
    let n = ord(c) - 1;
    return chr(n < 0 ? 0 : n);
  },
  succ(c: string): string {
    return chr(ord(c) + 1);
  },
  succSafe(c: string): string {
    let n = ord(c) + 1;
    return chr(n > CHAR_MAX_CODE_POINT ? CHAR_MAX_CODE_POINT : n);
  },
  hexEscape(c: string): string {
    let code = c.charCodeAt(0);
    return '\\x' + code.toString(16).padStart(2, '0');
  },
  unicodeEscape(c: string): string {
    let code = c.charCodeAt(0);
    return '\\u' + code.toString(16).padStart(4, '0');
  },
  codePointEscape(c: string): string {
    let code = c.codePointAt(0)!;
    return '\\u{' + code.toString(16) + '}';
  },
  /** Ctrl A-Z */
  ctrl(c: string): string {
    return String.fromCharCode(c.charCodeAt(0) % 32);
  },

  // Max unicode code point
  MAX_CODE_POINT: CHAR_MAX_CODE_POINT,
  MIN_CHAR: chr(0),
  MAX_CHAR: chr(CHAR_MAX_CODE_POINT)
};

/** Simple random int i, min <= i <= max. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const _hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwn(o: any, k: string): boolean {
  return _hasOwnProperty.call(o, k);
}

let _guidCount = 0;

/**
@deprecated Prefer WeakSet or WeakMap
*/
export function guidOf(obj: any): string {
  if (hasOwn(obj, '_GUID_')) {
    return obj._GUID_;
  } else {
    let _guid = guid();
    // Prohibit from enumerating
    Object.defineProperty(obj, '_GUID_', {value: _guid});
    return _guid;
  }
}

/**Alternative to Symbol()*/
export function guid(): string {
  _guidCount = (_guidCount + 1) | 0;
  return '_' + (+new Date()).toString(36).slice(2) + _guidCount.toString(36);
}

export function flat<T>(a: T[][]): T[] {
  return (<T[]>[]).concat(...a);
}

export function escapeUnicodes(s: string, codePointSyntax: boolean = true): string {
  let chars = codePointSyntax ? Array.from(s) : s.split('');
  return chars
    .map(c => {
      let cp = ord(c);
      let cps = cp.toString(16).toUpperCase();
      if (cp <= 0xff) {
        return c;
      } else if (cp > 0xffff) {
        return '\\u{' + cps + '}';
      } else {
        return '\\u' + cps.padStart(4, '0');
      }
    })
    .join('');
}

export function escapeRegex(s: string, inCharClass = false): string {
  s = s.replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&');
  if (inCharClass) {
    s = s.replace(/-/g, '\\$&');
  }
  return s;
}

export function sum(nums: number[]): number {
  let total = 0;
  for (let n of nums) {
    total += n;
  }
  return total;
}

export function enumNum(begin: number, end: number): number[] {
  let a = [];
  while (begin <= end) {
    a.push(begin++);
  }
  return a;
}
