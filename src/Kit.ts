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

const _excludeSignCodePoint = 94; //ord('^');
const _hyphenCodePoint = 45; // ord('-');
const _escapeCodePoint = 92; // ord('\\');

/** Math.pow(2,21). */
const B2_21 = 0x200000;
/** Math.pow(2,21) - 1. Bits Char.MAX_CODE_POINT used.  */
const B2_21_1 = 0x1fffff;

/**
Inclusive CharRange representation.
CharRangeRepr use number to save memory.
Number.MAX_SAFE_INTEGER is 0x1fffffffffffff, 53 bit.
Char.MAX_CODE_POINT is  0x10ffff, 21 bit.
A number is sufficient to pack two char code points.
```
rangeBegin = CharRangeRepr / Math.pow(2,21) & 0x1FFFFF  // shift right 21 bit
rangeEnd = CharRangeRepr &   0x1FFFFF // retain right 21 bit
```
A single code point use equal rangeBegin and rangeEnd.

Use {_nominal_:true} to enforce nominal type check CharRangeRepr.
Number can not directly assign to CharRangeRepr.

@example:
Single char "A" => `0x41 * Math.pow(2,21) + 0x41 === 0x8200041`
Single char "Z" => `0x5A * Math.pow(2,21) + 0x5A === 0xB40005A`
Range "A" to "Z" => `0x41 * Math.pow(2,21) + 0x5A === 0x820005A`

@todo:  Use another bit to repr char range with even gap.
"\x10\x12\x14\x16\x18" could be repr as range 0x10 to 0x18 but with even gap.
*/
export type CharRangeRepr = number & {_nominal_: true};

export namespace CharRange {
  /** Pack char range two chars to CharRangeRepr */
  export function fromCharPair(beginChar: string, endChar: string): CharRangeRepr {
    return pack(ord(beginChar), ord(endChar));
  }

  /** Pack single char to CharRangeRepr */
  export function singleChar(c: string): CharRangeRepr {
    return single(ord(c));
  }

  /** Pack single char code point to CharRangeRepr */
  export function single(codePoint: number): CharRangeRepr {
    return pack(codePoint, codePoint);
  }

  /** Pack char range two code points into number CharRangeRepr */
  export function pack(begin: number, end: number): CharRangeRepr {
    return (begin * B2_21 + end) as CharRangeRepr;
  }

  export function begin(r: CharRangeRepr): number {
    return (r / B2_21) & B2_21_1;
  }
  export function end(r: CharRangeRepr): number {
    return r & B2_21_1;
  }

  export function getSize(r: CharRangeRepr): number {
    return end(r) - begin(r) + 1;
  }

  export function includeChar(range: CharRangeRepr, c: string): boolean {
    let cp = ord(c);
    return includeCodePoint(range, cp);
  }

  export function includeCodePoint(range: CharRangeRepr, cp: number): boolean {
    return begin(range) <= cp && cp <= end(range);
  }

  export function isSubsetOf(a: CharRangeRepr, b: CharRangeRepr): boolean {
    return begin(b) <= begin(a) && end(a) <= end(b);
  }

  export function isSingle(r: CharRangeRepr): boolean {
    return begin(r) === end(r);
  }

  export function intersect(a: CharRangeRepr, b: CharRangeRepr): Maybe<CharRangeRepr> {
    let a1 = begin(a);
    let a2 = end(a);
    let b1 = begin(b);
    let b2 = end(b);
    if (b2 < a1 || a2 < b1) return;
    if (a1 <= b1) {
      if (b2 <= a2) return b;
      else return pack(b1, a2);
    } else {
      if (a2 <= b2) return a;
      else return pack(a1, b2);
    }
  }

  export function join(a: CharRangeRepr, b: CharRangeRepr): Maybe<CharRangeRepr> {
    let a1 = begin(a);
    let a2 = end(a);
    let b1 = begin(b);
    let b2 = end(b);
    if (b2 + 1 < a1 || a2 + 1 < b1) return;
    return pack(Math.min(a1, b1), Math.max(a2, b2));
  }

  /**
  Subtract range:
  a - b === a, if a and b have no overlap
  a - b === undefined, if a isSubsetof b
  a - b === range, if a starts with b or a ends with b
  a - b === [r1,r2], if b isSubsetof a and a.begin < b.begin && b.end < a.end
  */
  export function subtract(a: CharRangeRepr, b: CharRangeRepr): Maybe<CharRangeRepr | [CharRangeRepr, CharRangeRepr]> {
    let a1 = begin(a);
    let a2 = end(a);
    let b1 = begin(b);
    let b2 = end(b);
    if (b2 < a1 || a2 < b1) return a;
    let left = a1 < b1;
    let right = b2 < a2;
    if (left && right) return [pack(a1, b1 - 1), pack(b2 + 1, a2)];
    if (left) return pack(a1, b1 - 1);
    if (right) return pack(b2 + 1, a2);
    // if (!left && !right)  return;
  }

  /**
  Coalesce char range list to non-overlapping sorted ranges.
  */
  export function coalesce(ranges: CharRangeRepr[]): CharRangeRepr[] {
    let newRanges: CharRangeRepr[] = [];
    ranges = sortUnique(ranges, CharRange.compare);
    if (ranges.length <= 1) return ranges;

    let prev = ranges[0];
    for (let i = 1, l = ranges.length; i < l; i++) {
      let a = ranges[i];
      let joined = join(a, prev);
      if (typeof joined === 'undefined') {
        newRanges.push(prev);
        prev = a;
      } else {
        prev = joined;
      }
    }

    newRanges.push(prev);
    return newRanges;
  }

  export function compare(a: CharRangeRepr, b: CharRangeRepr): Ordering {
    if (a === b) return Ordering.EQ;
    if (a < b) return Ordering.LT;
    else return Ordering.GT;
  }

  export function compareIn(x: CharRangeRepr, r: CharRangeRepr): Ordering {
    if (isSubsetOf(x, r)) return Ordering.EQ;
    if (x < r) return Ordering.LT;
    else return Ordering.GT;
  }

  /**
  If char is less than range low bound, return LT, if char is in range, return EQ, and so forth.
  */
  export function compareCharToRange(c: string, range: CharRangeRepr): Ordering {
    return compareCodePointToRange(ord(c), range);
  }

  export function compareCodePointToRange(cp: number, range: CharRangeRepr): Ordering {
    let r1 = begin(range);
    let r2 = end(range);
    if (cp < r1) return Ordering.LT;
    if (cp > r2) return Ordering.GT;
    return Ordering.EQ;
  }

  /**
  Convert CharRange to regex char class like pattern string
  @see `Charset.fromPattern`
  */
  export function toPattern(range: CharRangeRepr): string {
    let r1 = begin(range);
    let r2 = end(range);
    if (r1 === r2) return toChar(r1);
    if (r1 + 1 === r2) return toChar(r1) + toChar(r2);
    return toChar(r1) + '-' + toChar(r2);

    function toChar(cp: number): string {
      if (cp === _escapeCodePoint || cp === _excludeSignCodePoint || cp === _hyphenCodePoint) {
        return '\\' + chr(cp);
      } else {
        return chr(cp);
      }
    }
  }

  export function toCodePoints(range: CharRangeRepr, maxCount = Infinity): number[] {
    let r1 = begin(range);
    let r2 = end(range);
    let a = [];
    while (r1 <= r2 && a.length < maxCount) {
      a.push(r1++);
    }
    return a;
  }
}
