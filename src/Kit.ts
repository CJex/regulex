import * as UT from 'utility-types';

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

export type Writable<T> = {-readonly [P in keyof T]-?: T[P]};

/** Union to Intersection */
export type InterU<U> = (U extends any ? (a: U) => 0 : never) extends ((a: infer I) => 0) ? I : never;

export type ArrayIndex<T> = Exclude<keyof T, Extract<keyof any[], string>>;

export type Equal<A, B> = A extends B ? (B extends A ? true : false) : false;

/**
Substitude Type A to B in Type Expr E recursively.
@param InferInter  Whether infer intersection type, only works when A is TypeVar.
*/
export type Subst<E, A, B, InferInter = false> = InferInter extends true
  ? (E extends A & infer X ? B & (X extends A ? unknown : X) : SubstIn<E, A, B, true>)
  : (E extends A ? B : SubstIn<E, A, B, false>);

/**
SubstIn is same as Subst except it wont replace top E.
@example
  type T = number | {body: T};
  let a: SubstIn<T, T, Date>; a = 1; a = {body: new Date()};
  let b: Subst<T, T, Date>; b = new Date();
*/
export type SubstIn<E, A, B, InferInter = false> =
  // First check extends Primitive in order to distribute over union types
  // Subst unknown check if E does not contain type A, then preserve its type name
  // Thus SubstIn<A[] | X, B> will preserve type name X if X does not contain type A
  E extends UT.Primitive ? E : SubstInRaw<E, A, unknown, InferInter> extends E ? E : SubstInRaw<E, A, B, InferInter>;

export type SubstInRaw<E, A, B, InferInter> = E extends (...a: infer Params) => infer Ret
  ? (...a: SubstInRaw<Params, A, B, InferInter>) => Subst<Ret, A, B, InferInter>
  : E extends [any, ...any[]]
  ? SubstRecord<E, A, B, InferInter>
  : E extends Array<infer X>
  ? SubstArray<X, A, B, InferInter>
  : E extends ReadonlyArray<infer X>
  ? SubstROArray<X, A, B, InferInter>
  : SubstRecord<E, A, B, InferInter>;

export type SubstRecord<E, A, B, InferInter> = {[K in keyof E]: Subst<E[K], A, B, InferInter>};
/*
// This definition will cause error "Type instantiation is excessively deep and possibly infinite"
// Use interface extends to defer the type instantiation

export type SubstArray<E, A, B, InferInter> = E extends Array<any>
  ? Array<{[I in keyof E]: Subst<E[I], A, B, InferInter>}[Exclude<keyof E, string>]>
  : ReadonlyArray<{[I in keyof E]: Subst<E[I], A, B, InferInter>}[Exclude<keyof E, string>]>;
*/
export interface SubstArray<X, A, B, InferInter> extends Array<Subst<X, A, B, InferInter>> {}
export interface SubstROArray<X, A, B, InferInter> extends ReadonlyArray<Subst<X, A, B, InferInter>> {}

export interface $<S extends string> {
  _TypeVar_: S;
}
export type TypeVar<S extends string> = $<S>;

/** TypeFn, use lamda symbol for better show. (Greek Small Letter Lamda) */
export interface λ<Param extends string, Body> {
  _TypeFn_: {
    _Param_: Param;
    _Body_: Body;
  };
}

export type TypeFn<Param extends string, Body> = λ<Param, Body>;
export type ParamVarOfTypeFn<F> = F extends TypeFn<infer Param, any> ? $<Param> : never;
export type BodyOfTypeFn<F> = F extends TypeFn<any, infer Body> ? Body : never;

export type AppF<F, A> = F extends TypeFn<infer Param, infer Body> ? Subst<Body, $<Param>, A, true> : F;

/** Identity Type Function λx.x */
export type IdentF = TypeFn<'x', $<'x'>>;
/**
@deprecated AppF already did the job to act as a const function when apply to non TypeFn, in other words, every type X(X is not TypeFn) is itself a ConstF<X>.
*/
export type ConstF<X> = TypeFn<'_', X>;

/**
The structures of FSubst and FSubstIn are same as their non-F counterparts except the third type param B becomes a type function F which recieve the subtype occurrence of A as parameter;
*/
export type FSubst<E, A, F> = E extends A ? AppF<F, FSubstIn<E, A, F>> : FSubstIn<E, A, F>;

export type FSubstIn<E, A, F> =
  // See `SubstIn`
  E extends UT.Primitive ? E : SubstIn<E, A, unknown> extends E ? E : FSubstInRaw<E, A, F>;

export type FSubstInRaw<E, A, F> = E extends (...a: infer Params) => infer Ret
  ? (...a: FSubstInRaw<Params, A, F>) => FSubst<Ret, A, F>
  : E extends [any, ...any[]]
  ? FSubstRecord<E, A, F>
  : E extends ReadonlyArray<any>
  ? FSubstArray<E, A, F>
  : FSubstRecord<E, A, F>;

export type FSubstRecord<E, A, F> = {[K in keyof E]: FSubst<E[K], A, F>};
export type FSubstArray<E, A, F> = E extends Array<any>
  ? Array<{[I in keyof E]: FSubst<E[I], A, F>}[Exclude<keyof E, string>]>
  : ReadonlyArray<{[I in keyof E]: FSubst<E[I], A, F>}[Exclude<keyof E, string>]>;

/**
Data.Fix
@deprecated Impractical, use `SubstIn` and `FSubstIn` instead.
@example
  type A = {kind:'A',name:string};
  type B = {kind:'B',target:T1};
  type T1 = A | B;
  type C = {kind:'C',items:T1[]};
  type T2 = Fix<T1 | C>;
*/
export type Fix<T> = {unfix: SubstIn<T, T, Fix<T>>};

/**
Transform (A => B | A => C) to (A => B|C)
*/
export type UnionF<F> = [F] extends [Function]
  ? [F] extends [(...a: infer A) => infer B]
    ? (...a: A) => B
    : never
  : F;

/** Index Signature */
export function IndexSig<T>(a: T): {[k: string]: UnionF<T[keyof T]>} {
  return a as any;
}

export type OK<T> = {value: T};
export type Err<E> = {error: E};

export type Result<T, E> = OK<T> | Err<E>;

export function isResultOK<A>(a: Result<A, any>): a is OK<A> {
  return (<Err<any>>a).error === undefined;
}

export function Err<E>(a: E): undefined extends E ? never : Err<E> {
  return <any>{error: a};
}

export function OK<T>(a: T): OK<T> {
  return {value: a};
}

export interface Eq<A> {
  equals: (x: A, y: A) => boolean;
}

export interface Comparator<A> {
  (x: A, y: A): Ordering;
}

/**
Usage: function f<S extends Stream<S>>(s:S):S {return s.slice()}
*/
export interface Stream<S extends {readonly [index: number]: S[number]}> {
  readonly [index: number]: S[number];
  length: number;
  slice(): S;
  slice(start: number): S;
  slice(start: number, end: number): S;
}

export function compare<T>(a: T, b: T): Ordering {
  if (a > b) return Ordering.GT;
  if (a < b) return Ordering.LT;
  return Ordering.EQ;
}

export function compareArray<S extends Stream<S>>(a1: S, a2: S, cmp: Comparator<S[number]> = compare): Ordering {
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

export function escapeNonAlphanum(s: string, codePointSyntax: boolean = true): string {
  let alphanum = /^[A-Z0-9\-\\]$/i;
  let chars = codePointSyntax ? Array.from(s) : s.split('');
  return chars
    .map(c => {
      let cp = ord(c);
      let cps = cp.toString(16).toUpperCase();
      if (alphanum.test(c)) {
        return c;
      } else if (cp <= 0xf) {
        return '\\x0' + cps;
      } else if (cp <= 0xff) {
        return '\\x' + cps;
      } else if (cp <= 0xfff) {
        return '\\u0' + cps;
      } else if (cp > 0xffff) {
        return '\\u{' + cps + '}';
      } else {
        return '\\u' + cps;
      }
    })
    .join('');
}

export function escapeRegex(s: string, inCharClass = false): string {
  s = s.replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&');
  if (inCharClass) {
    s = s.replace(/-/g, '\\-');
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

export function invertMap<K, V>(m: Map<K, V>): Map<V, K> {
  return new Map(Array.from(m).map(kv => kv.reverse() as [V, K]));
}

type _InvertRecord<M> = InterU<{[K in keyof M]: {[V in M[K] extends keyof any ? M[K] : string]: K}}[keyof M]>;

export type InvertRecord<M> =
  // Ensure values of M are distinct types.
  // Overlaps will result in intersection type instead of union
  // which surely not super type of keyof M
  keyof M extends _InvertRecord<M>[keyof _InvertRecord<M>]
    ? _InvertRecord<M>
    : {[k in M[keyof M] extends keyof any ? M[keyof M] : string]: string};

export function invertRecord<M>(m: M): InvertRecord<M>;
export function invertRecord(m: any): any {
  let a = {} as any;
  for (let k in m) {
    a[m[k]] = k;
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

/**
Regex like Charset,support ranges and invertion
@example Charset.fromPattern("^a-z0-9")
*/
export class Charset {
  static readonly unicode = new Charset([CharRange.pack(0, Char.MAX_CODE_POINT)]);
  static readonly empty = new Charset([]);
  readonly ranges: CharRangeRepr[];

  /**
  Regex like char class pattern string like '^a-f123' to Charset: exclude range "a" to "f" and chars "123".
  Support "^" to indicate invertion. Char "\" only used to escape "-" and "\" itself.
  Char classes like "\w\s" are not supported!
  @param {string} re  Regex like char class [^a-z0-9_] input as "^a-z0-9_".
  */
  static fromPattern(re: string): Charset {
    if (!re.length) return Charset.empty;
    let codePoints = Array.from(re).map(ord);
    let stack: number[] = [];
    let ranges: CharRangeRepr[] = [];
    let exclude = false;
    let i = 0;

    if (codePoints[0] === _excludeSignCodePoint && codePoints.length > 1) {
      i++;
      exclude = true;
    }

    for (let l = codePoints.length; i < l; i++) {
      let cp = codePoints[i];
      if (cp === _escapeCodePoint) {
        // Identity escape,e.g. "-" and "="
        if (++i < l) {
          stack.push(codePoints[i]);
        } else {
          throw new SyntaxError('Invalid end escape');
        }
      } else if (cp === _hyphenCodePoint) {
        i++;
        if (stack.length > 0 && i < l) {
          let rangeBegin = stack.pop()!;
          let rangeEnd = codePoints[i];
          if (rangeEnd === _escapeCodePoint) {
            if (++i < l) {
              rangeEnd = codePoints[i];
            } else {
              throw new SyntaxError('Invalid end escape');
            }
          }
          if (rangeBegin > rangeEnd) {
            // z-a  is invalid
            throw new RangeError(
              'Charset range out of order: ' +
                escapeNonAlphanum(String.fromCodePoint(rangeBegin, _hyphenCodePoint, rangeEnd)) +
                ' !\n' +
                escapeNonAlphanum(re)
            );
          }
          ranges.push(CharRange.pack(rangeBegin, rangeEnd));
        } else {
          throw new SyntaxError(
            'Incomplete char range at ' + i + ': ' + String.fromCodePoint(...codePoints.slice(i - 2, i + 2))
          );
        }
      } else {
        stack.push(cp);
      }
    }

    ranges = ranges.concat(stack.map(CharRange.single));
    let charset = new Charset(ranges);
    if (exclude) {
      return Charset.unicode.subtract(charset);
    } else {
      return charset;
    }
  }

  /**
  Build from single char list.
  */
  static fromChars(chars: string) {
    return Charset.fromCodePoints(Array.from(chars).map(ord));
  }

  static fromCodePoints(codePoints: number[]) {
    return new Charset(codePoints.map(CharRange.single));
  }

  /**
  Create from CharRange list.
  */
  constructor(ranges: CharRangeRepr[]) {
    this.ranges = CharRange.coalesce(ranges);
  }

  includeChar(c: string): boolean {
    return this.includeCodePoint(ord(c));
  }

  includeCodePoint(cp: number): boolean {
    let {found} = bsearch<CharRangeRepr, number>(this.ranges, cp, (cp, range) => {
      return CharRange.compareCodePointToRange(cp, range);
    });
    return found;
  }

  includeRange(range: CharRangeRepr): boolean {
    let {found} = bsearch(this.ranges, range, (range, x) => {
      if (CharRange.isSubsetOf(range, x)) return Ordering.EQ;
      return CharRange.compare(range, x);
    });
    return found;
  }

  isSubsetof(parent: Charset): boolean {
    let a = this.intersect(parent);
    return a.equals(this);
  }

  isEmpty() {
    return !this.ranges.length;
  }

  _size?: number;
  /**
  Get Charset total count of chars
  */
  getSize(): number {
    if (this._size === undefined) {
      this._size = sum(this.ranges.map(CharRange.getSize));
    }
    return this._size;
  }

  getMinCodePoint(): Maybe<number> {
    if (!this.ranges.length) return;
    return CharRange.begin(this.ranges[0]);
  }

  getMaxCodePoint(): Maybe<number> {
    if (!this.ranges.length) return;
    return CharRange.end(this.ranges[this.ranges.length - 1]);
  }

  subtract(other: Charset): Charset {
    let newRanges: CharRangeRepr[] = [];
    let thisRanges = this.ranges.slice();
    let toExcludeRanges = other.ranges;
    let i = 0;

    loopNextExclude: for (let ex of toExcludeRanges) {
      for (; i < thisRanges.length; i++) {
        let range = thisRanges[i];
        let rg = CharRange.subtract(range, ex);
        if (rg === range) {
          // no overlap
          if (range > ex) {
            continue loopNextExclude;
          } else {
            newRanges.push(range);
            continue;
          }
        } else if (typeof rg === 'undefined') {
          // whole a has been excluded
          continue;
        } else if (Array.isArray(rg)) {
          newRanges.push(rg[0]);
          thisRanges[i] = rg[1];
          continue loopNextExclude;
        } else {
          if (rg < ex) {
            newRanges.push(rg);
            continue;
          } else {
            thisRanges[i] = rg;
            continue loopNextExclude;
          }
        }
      }

      break;
    }

    let ranges = newRanges.concat(thisRanges.slice(i));
    if (!ranges.length) return Charset.empty;

    return new Charset(ranges);
  }

  inverted(): Charset {
    return Charset.unicode.subtract(this);
  }

  union(other: Charset): Charset {
    return new Charset(this.ranges.concat(other.ranges));
  }

  intersect(other: Charset): Charset {
    let otherRanges = other.ranges.slice();
    let thisRanges = this.ranges;
    let newRanges: CharRangeRepr[] = [];
    for (let i = 0, j = 0; i < thisRanges.length && j < otherRanges.length; ) {
      let r1 = thisRanges[i];
      let r2 = otherRanges[j];

      let inter = CharRange.intersect(r1, r2);
      if (typeof inter === 'undefined') {
        // no overlap
        if (r1 < r2) i++;
        else j++;
      } else {
        newRanges.push(inter);
        let end1 = CharRange.end(r1);
        let end2 = CharRange.end(r2);
        if (end1 <= end2) i++;
        if (end2 <= end1) j++;
      }
    }

    if (!newRanges.length) return Charset.empty;

    return new Charset(newRanges);
  }

  equals(other: Charset): boolean {
    if (this.ranges.length !== other.ranges.length) return false;
    return compareArray(this.ranges, other.ranges, CharRange.compare) === Ordering.EQ;
  }

  toPattern(): string {
    return this.ranges.map(CharRange.toPattern).join('');
  }

  toString(): string {
    return escapeNonAlphanum(this.toPattern());
  }

  toRegex(): RegExp {
    return new RegExp('[' + this.toPattern().replace(/[\[\]]/g, '\\$&') + ']', 'u');
  }

  toCodePoints(maxCount = Infinity): number[] {
    let a = [];
    for (let r of this.ranges) {
      let b = CharRange.toCodePoints(r, maxCount);
      maxCount -= b.length;
      a.push(b);
    }

    return flat(a);
  }

  [_inspect_](): string {
    return this.toString();
  }

  static compare(a: Charset, b: Charset): Ordering {
    if (a === b) return Ordering.EQ;
    return compareArray(a.ranges, b.ranges, CharRange.compare);
  }

  static union(a: Charset[]): Charset {
    return a.reduce((prev, current) => prev.union(current), Charset.empty);
  }
}
