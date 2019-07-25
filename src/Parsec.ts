import * as K from './Kit';
import {Err, Result, isResultOK, InterU} from './Kit';
import {$Values} from 'utility-types';

/**
Not Really Parser Combinator

Parsec<S,A,State,UserError>
S is the input stream type.
A is result value type.
State is user custom state type.
UserError is user custom ParseError.userError type.
*/
export interface ParseError<UserError> {
  position: number;
  parser?: Parser<any, any, any, any>;
  message?: string;
  userError?: UserError;
}

type Failed<UserError> = Err<ParseError<UserError>>;
export type SimpleResult<A, UserError> = Result<A, ParseError<UserError>>;
export type ParseResult<A, State, UserError> = Result<A, ParseError<UserError>> & {
  consumed: number;
  state: State;
};

class ParseCtx<S extends K.Stream<S>, State, UserError> {
  public position: number = 0;
  // A shared and mutable range field.
  // So we can directly convert ParseCtx to TokenCtx and avoid temp object;
  public range: TokenRange = [0, 0];
  public readonly recurMemo: Map<
    Parser<S, any, State, UserError>,
    Map<number, {position: number; state: State; result: SimpleResult<any, UserError>}>
  >;

  constructor(public readonly input: S, public state: State) {
    this.recurMemo = new Map();
  }
}

export type GetParserResultType<P> = P extends Parser<any, infer A, any, any> ? A : never;

/**
Open end range
@example "a" in "abc" range is [0,1]
*/
export type TokenRange = [number, number];
export interface TokenCtx<S, State> {
  readonly input: S;
  range: TokenRange;
  state: State;
}

export abstract class Parser<S extends K.Stream<S>, A, State, UserError> {
  /**
  Map result value. Changing state in the map function is allowed, ensure yourself the parser is unrecoverable.
  (Why that? Because we don't have *REAL* immutable data type.)
  */
  map<B>(f: (v: A, ctx: TokenCtx<S, State>) => B): Parser<S, B, State, UserError> {
    return MapF.compose(
      this,
      (r, ctx) => {
        if (isResultOK(r)) {
          return {value: f(r.value, ctx)};
        } else {
          return r;
        }
      }
    );
  }

  /**
  Map result function return with UserError
  */
  mapE<B>(f: (v: A, ctx: TokenCtx<S, State>) => Result<B, UserError>): Parser<S, B, State, UserError> {
    let p: Parser<S, B, State, UserError> = MapF.compose(
      this,
      (r, ctx) => {
        if (isResultOK(r)) {
          let r2 = f(r.value, ctx);
          if (isResultOK(r2)) {
            return r2;
          } else {
            return {
              error: {
                position: ctx.range[0],
                parser: p,
                userError: r2.error
              }
            };
          }
        } else {
          return r;
        }
      }
    );

    return p;
  }

  mapF<B>(
    f: (a: SimpleResult<A, UserError>, ctx: TokenCtx<S, State>) => SimpleResult<B, UserError>
  ): Parser<S, B, State, UserError> {
    return MapF.compose(
      this,
      f
    );
  }

  /**
  Map result UserError
  */
  mapError(f: (err: UserError) => UserError): Parser<S, A, State, UserError> {
    return MapF.compose(
      this,
      r => {
        if (isResultOK(r)) return r;
        if (r.error.userError) {
          r.error.userError = f(r.error.userError);
        }
        return r;
      }
    );
  }

  /**
  We had allowed changing state in map function. But this is required by recoverable parsers in alternative branches
  */
  stateF(f: (st: State, ctx: TokenCtx<S, State>) => State): StateF<S, A, State, UserError> {
    return new StateF(this, f);
  }

  slice(): Parser<S, S, State, UserError> {
    return this.map((_, ctx) => ctx.input.slice(ctx.range[0], ctx.range[1]));
  }

  opt(): Optional<S, A, State, UserError> {
    return new Optional(this);
  }

  trys(): TryParser<S, A, State, UserError> {
    return new TryParser(this);
  }

  followedBy(look: Parser<S, any, State, UserError>): Lookahead<S, A, State, UserError> {
    return new Lookahead(this, look, false);
  }

  notFollowedBy(look: Parser<S, any, State, UserError>): Lookahead<S, A, State, UserError> {
    return new Lookahead(this, look, true);
  }

  /** Right biased sequence */
  thenR<B>(next: Parser<S, B, State, UserError>): Parser<S, B, State, UserError> {
    return new Seqs([this, next]).at(1);
  }

  /** Left biased sequence */
  thenL(next: Parser<S, any, State, UserError>): Parser<S, A, State, UserError> {
    return new Seqs([this, next]).at(0);
  }

  and<B>(next: Parser<S, B, State, UserError>): Seqs<S, [A, B], State, UserError> {
    return new Seqs([this, next]);
  }

  between(
    left: Parser<S, any, State, UserError>,
    right: Parser<S, any, State, UserError>
  ): Parser<S, A, State, UserError> {
    return new Seqs([left, this, right]).at(1);
  }

  repeat(min: number = 0, max: number = Infinity): Repeat<S, A, State, UserError> {
    return new Repeat(this, min, max);
  }

  count(n: number) {
    return this.repeat(n, n);
  }

  many(): Repeat<S, A, State, UserError> {
    return this.repeat();
  }
  some(): Repeat<S, A, State, UserError> {
    return this.repeat(1);
  }

  betweens(left: S, right: S): Parser<S, A, State, UserError> {
    return new Seqs([new Exact<S, State, UserError>(left), this, new Exact<S, State, UserError>(right)]).at(1);
  }

  parse(s: S, initalState: State): ParseResult<A, State, UserError> {
    let context = new ParseCtx<S, State, UserError>(s, initalState);
    let result: any = this._parseWith(context);
    result.state = context.state;
    result.consumed = context.position;
    return result;
  }

  abstract _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError>;

  private _nullable?: boolean;
  isNullable(): boolean {
    if (typeof this._nullable === 'boolean') return this._nullable;
    // Default true to prevent left recursion.
    Object.defineProperty(this, '_nullable', {value: true, writable: true});
    return (this._nullable = this._checkNullable());
  }

  _checkNullable() {
    return false;
  }

  // Resolve Reference
  private _dereferenced?: boolean;
  // Get Ref parser dereferenced
  _getDeref(): Parser<S, A, State, UserError> {
    if (this._dereferenced) {
      return this;
    } else {
      // To hide trivial private properties from debug inspector
      // Default true to prevent recursion
      Object.defineProperty(this, '_dereferenced', {value: true, writable: true});
      return this._deref();
    }
  }

  _deref(): Parser<S, A, State, UserError> {
    return this;
  }

  /**
  Get NonNullable left first set
  */
  _getFirstSet(): Array<Parser<any, any, any, any>> {
    return [this];
  }

  // Description
  desc(): string {
    return this.constructor.name;
  }

  [K._inspect_]() {
    return this.desc();
  }
}

export type FResult<A, UserError> = Result<A, UserError | string | true> & {consumed: number};
export class FParser<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(
    private _f: (context: {
      readonly input: S;
      readonly position: number;
      readonly state: State;
    }) => FResult<A, UserError>
  ) {
    super();
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let result: any = this._f(context);
    if (result.error) {
      let errorResult: Failed<UserError> = {
        error: {
          position: context.position,
          parser: this
        }
      };
      if (typeof result.error === 'string') {
        errorResult.error.message = result.error;
      } else if (result.error !== true) {
        errorResult.error.userError = result.error;
      }
      return errorResult;
    } else {
      context.position += result.consumed;
      return {value: result.value};
    }
  }
}

class MapF<S extends K.Stream<S>, A, B, State, UserError> extends Parser<S, B, State, UserError> {
  private constructor(
    private _p: Parser<S, A, State, any>,
    private _f: (v: SimpleResult<A, UserError>, ctx: TokenCtx<S, State>) => SimpleResult<B, UserError>
  ) {
    super();
  }

  static compose<S extends K.Stream<S>, A, B, State, UserError>(
    p: Parser<S, A, State, UserError>,
    f: (v: SimpleResult<A, UserError>, ctx: TokenCtx<S, State>) => SimpleResult<B, UserError>
  ): MapF<S, A, B, State, UserError> {
    if (p instanceof MapF) {
      let g = p._f;
      return new MapF(p._p, (v, ctx) => f(g(v, ctx), ctx));
    }
    return new MapF(p, f);
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<B, UserError> {
    let position = context.position;
    let result: SimpleResult<A, UserError> = this._p._parseWith(context);
    let tokenCtx: TokenCtx<S, State> = context;
    context.range = [position, context.position];
    return this._f(result, tokenCtx);
  }

  // Unsafe, because we allowed changing state in map function
  thenR<C>(next: Parser<S, C, State, UserError>): Parser<S, C, State, UserError> {
    return this._p.thenR(next);
  }

  thenL(next: Parser<S, any, State, UserError>): Parser<S, B, State, UserError> {
    return MapF.compose(
      this._p.thenL(next),
      this._f
    );
  }

  _checkNullable(): boolean {
    return this._p.isNullable();
  }

  _deref(): this {
    this._p = this._p._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }
}

export class StateF<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(private _p: Parser<S, A, State, UserError>, private _f: (st: State, ctx: TokenCtx<S, State>) => State) {
    super();
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let startPos = context.position;
    let result = this._p._parseWith(context);
    if (isResultOK(result)) {
      context.range = [startPos, context.position];
      context.state = this._f(context.state, context);
    }
    return result;
  }

  _checkNullable(): boolean {
    return this._p.isNullable();
  }

  _deref(): this {
    this._p = this._p._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }
}

export class Optional<S extends K.Stream<S>, A, State, UserError> extends Parser<S, K.Maybe<A>, State, UserError> {
  constructor(private _p: Parser<S, A, State, UserError>) {
    super();
  }
  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<K.Maybe<A>, UserError> {
    let {position, state} = context;
    let result = this._p._parseWith(context);
    if (!isResultOK(result) && context.position === position) {
      context.state = state;
      return {value: undefined};
    }
    return result;
  }

  isNullable() {
    return true;
  }

  _deref(): this {
    this._p = this._p._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }
}

export class TryParser<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(private _p: Parser<S, A, State, UserError>) {
    super();
  }
  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let {position, state} = context;
    let result = this._p._parseWith(context);
    if (!isResultOK(result)) {
      context.position = position;
      context.state = state;
    }
    return result;
  }

  _checkNullable(): boolean {
    return this._p.isNullable();
  }

  _deref(): this {
    this._p = this._p._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }
}

export class Lookahead<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(
    private _p: Parser<S, A, State, UserError>,
    private _look: Parser<S, any, State, UserError>,
    private _negative: boolean
  ) {
    super();
  }
  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let result = this._p._parseWith(context);
    if (isResultOK(result)) {
      let {position, state} = context;
      let a = this._look._parseWith(context);
      context.position = position;
      context.state = state;

      let ok = isResultOK(a);
      if (ok === this._negative) {
        if (ok) return {error: {position: position, parser: this}};
        else return a;
      }
    }
    return result;
  }

  _checkNullable(): boolean {
    return this._look.isNullable();
  }

  _deref(): this {
    this._p = this._p._getDeref();
    this._look = this._look._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }
}

export class Seqs<S extends K.Stream<S>, A extends Array<any>, State, UserError> extends Parser<
  S,
  A,
  State,
  UserError
> {
  constructor(private _items: Array<Parser<S, any, State, UserError>>) {
    super();
    if (!_items.length) throw new Error('Seqs can not be empty');
  }

  thenR<B>(next: Parser<S, B, State, UserError>): Parser<S, B, State, UserError> {
    return new Seqs(this._items.concat([next])).map(a => a[a.length - 1]);
  }

  at<N extends number>(n: N): Parser<S, A[N], State, UserError> {
    return this.map(a => a[n]);
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let plist = this._items;
    let value: any = [];
    for (let i = 0; i < plist.length; i++) {
      let p = plist[i];
      let result = p._parseWith(context);
      if (isResultOK(result)) {
        value.push(result.value);
      } else {
        return result;
      }
    }

    return {value};
  }

  _checkNullable() {
    for (let p of this._items) {
      if (!p.isNullable()) return false;
    }
    return true;
  }

  _deref(): this {
    for (let i = 0; i < this._items.length; i++) {
      this._items[i] = this._items[i]._getDeref();
    }
    return this;
  }

  _getFirstSet() {
    let all: any = [];
    for (let p of this._items) {
      let first = p._getFirstSet();
      all = all.concat(first);
      if (!p.isNullable()) {
        return all;
      }
    }
    return all;
  }

  desc(): string {
    let seqs = this._items.map(p => p.desc()).join(',');
    return `Seqs(${seqs})`;
  }
}

export class Alts<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(private _alts: Array<Parser<S, A, State, UserError>>) {
    super();
    if (!_alts.length) throw new Error('Alts can not be empty');
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let plist = this._alts;
    let len = plist.length;
    let result;
    let i = 0;
    let {position, state} = context;
    do {
      result = plist[i]._parseWith(context);
      if (isResultOK(result) || context.position !== position) return result;
      context.position = position;
      context.state = state;
    } while (++i < len);
    return result;
  }

  _checkNullable() {
    for (let p of this._alts) {
      if (p.isNullable()) return true;
    }
    return false;
  }

  _deref(): this {
    for (let i = 0; i < this._alts.length; i++) {
      this._alts[i] = this._alts[i]._getDeref();
    }
    return this;
  }

  _getFirstSet() {
    let all: Parser<S, A, State, UserError>[] = [];
    for (let p of this._alts) {
      let aset = p._getFirstSet();
      all = all.concat(aset);
    }
    return all;
  }

  desc() {
    let alts = this._alts.map(p => p.desc()).join(',');
    return `Alts(${alts})`;
  }
}

export class Repeat<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A[], State, UserError> {
  constructor(private _p: Parser<S, A, State, UserError>, private _min: number = 0, private _max: number = Infinity) {
    super();
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A[], UserError> {
    let count = 0;
    let value = [];
    for (; count < this._max; count++) {
      let oldPosition = context.position;
      let result = this._p._parseWith(context);
      if (isResultOK(result)) {
        value.push(result.value);
      } else {
        if (context.position !== oldPosition || count < this._min) {
          return result;
        }
        break;
      }
    }

    return {value};
  }

  isNullable() {
    return this._min === 0;
  }

  _deref(): this {
    this._p = this._p._getDeref();
    if (this._p.isNullable()) {
      throw new Error('Repeat on nullable parser:' + this._p.desc());
    }
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }

  desc() {
    return `${this._p.desc()}.repeat(${this._min},${this._max})`;
  }
}

// @singleton
class Empty<State, UserError> extends Parser<any, undefined, State, UserError> {
  _parseWith(context: ParseCtx<any, State, UserError>): SimpleResult<undefined, UserError> {
    return {value: undefined};
  }

  isNullable() {
    return true;
  }
}

// @singleton
class EOF<State, UserError> extends Empty<State, UserError> {
  _parseWith(context: ParseCtx<any, State, UserError>): SimpleResult<undefined, UserError> {
    if (context.position === context.input.length) return {value: undefined};
    else return {error: {position: context.position, parser: this}};
  }
}

class FailParser<State, UserError> extends Parser<any, never, State, UserError> {
  constructor(private _msg: string, private _userError?: UserError) {
    super();
  }

  _parseWith(context: ParseCtx<any, State, UserError>) {
    let a: Failed<UserError> = {error: {parser: this, position: context.position, message: this._msg}};
    if (this._userError !== undefined) {
      a.error.userError = this._userError;
    }
    return a;
  }

  isNullable() {
    return true;
  }
}

export class Exact<S extends K.Stream<S>, State, UserError> extends Parser<S, S, State, UserError> {
  constructor(private _s: S) {
    super();
    if (!_s.length) throw new Error('Exact match empty make no sense, please use Parsec.empty instead!');
  }

  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<S, UserError> {
    let l = this._s.length;
    let {input, position} = context;
    let s = input.slice(position, position + l);
    if (s === this._s || K.deepEqual(s, this._s)) {
      context.position += l;
      return {value: this._s};
    } else {
      return {error: {position: position, parser: this}};
    }
  }

  isNullable() {
    return false;
  }

  desc() {
    return `Exact(${JSON.stringify(this._s)})`;
  }
}

export interface RegexRepeat<State, UserError> {
  getRegexSource(): string;
  repeats(min: number, max: number): Parser<string, string, State, UserError>;
  counts(n: number): Parser<string, string, State, UserError>;
}

function _repeats<State, UserError>(
  this: RegexRepeat<State, UserError>,
  min = 0,
  max = Infinity
): Parser<string, string, State, UserError> {
  let re = '(?:' + this.getRegexSource() + ')';
  let quantifier = '{' + min + ',' + (max === Infinity ? '' : max) + '}';
  let p: MatchRegex<State, UserError> = new MatchRegex(new RegExp(re + quantifier, 'u'));
  return p.map(m => m[0]);
}

function _counts<State, UserError>(
  this: RegexRepeat<State, UserError>,
  n: number
): Parser<string, string, State, UserError> {
  return this.repeats(n, n);
}

abstract class CharsetBase<State, UserError> extends Parser<string, string, State, UserError>
  implements RegexRepeat<State, UserError> {
  _parseWith(context: ParseCtx<string, State, UserError>): SimpleResult<string, UserError> {
    let {position, input} = context;
    let cp = input.codePointAt(position);
    if (typeof cp === 'undefined') {
      return {
        error: {position: position, parser: this, message: 'EOF'}
      };
    } else if (this._includeCodePoint(cp)) {
      let c = String.fromCodePoint(cp);
      context.position += c.length;
      return {value: c};
    } else {
      return {error: {position: position, parser: this}};
    }
  }

  abstract _includeCodePoint(cp: number): boolean;
  abstract getRegexSource(): string;

  repeats: (min?: number, max?: number) => Parser<string, string, State, UserError> = _repeats;
  counts: (n: number) => Parser<string, string, State, UserError> = _counts;

  isNullable() {
    return false;
  }

  _getDeref() {
    return this;
  }
}

export class CharsetParser<State, UserError> extends CharsetBase<State, UserError> {
  constructor(private _charset: K.Charset) {
    super();
  }

  _includeCodePoint(cp: number): boolean {
    return this._charset.includeCodePoint(cp);
  }

  getRegexSource(): string {
    return this._charset.toRegex().source;
  }

  desc() {
    return `Charset(${JSON.stringify(this._charset.toPattern())})`;
  }
}

export class OneOf<State, UserError> extends CharsetBase<State, UserError> {
  _set: Set<number>;
  constructor(a: string) {
    super();
    this._set = new Set(Array.from(a).map(K.Char.ord));
  }

  _includeCodePoint(cp: number): boolean {
    return this._set.has(cp);
  }

  getRegexSource(): string {
    return K.Charset.fromCodePoints(Array.from(this._set)).toRegex().source;
  }

  desc() {
    return (
      this.constructor.name +
      `(${JSON.stringify(
        Array.from(this._set)
          .map(K.Char.chr)
          .join('')
      )})`
    );
  }
}

export class NoneOf<State, UserError> extends OneOf<State, UserError> {
  _includeCodePoint(cp: number): boolean {
    return !this._set.has(cp);
  }

  getRegexSource(): string {
    return K.Charset.fromCodePoints(Array.from(this._set))
      .inverted()
      .toRegex().source;
  }
}

export class MatchRegex<State, UserError> extends Parser<string, string[] & RegExpExecArray, State, UserError>
  implements RegexRepeat<State, UserError> {
  _re: RegExp;
  _rawRe: RegExp;
  constructor(re: RegExp) {
    super();
    this._rawRe = re;
    this._re = new RegExp(re.source, re.flags.replace('y', '') + 'y');
  }

  _parseWith(context: ParseCtx<string, State, UserError>): SimpleResult<string[] & RegExpExecArray, UserError> {
    let {input, position} = context;
    this._re.lastIndex = position;
    let m = this._re.exec(input);
    if (m === null) {
      return {error: {position: position, parser: this}};
    } else {
      context.position += m[0].length;
      return {value: m};
    }
  }

  slice(): Parser<string, string, State, UserError> {
    return this.map(m => m[0]);
  }

  _checkNullable() {
    return this._re.test('');
  }

  repeats: (min?: number, max?: number) => Parser<string, string, State, UserError> = _repeats;
  counts: (n: number) => Parser<string, string, State, UserError> = _counts;

  getRegexSource(): string {
    return this._rawRe.source;
  }

  desc() {
    return `Regex(${this._rawRe.toString()})`;
  }
}

interface AnyParserMap {
  [refName: string]: Parser<any, any, any, any>;
}

// @private
class Ref extends Parser<any, any, any, any> {
  private _p?: Parser<any, any, any, any>;
  constructor(private _refName: string) {
    super();
  }

  resolveRef(ruleMap: AnyParserMap) {
    let p = ruleMap[this._refName];
    if (!p) {
      throw new Error('Referenced rule does not exist: ' + this._refName);
    }
    this._p = p;
  }

  isNullable() {
    return this._p!.isNullable();
  }
  _getFirstSet() {
    return [this];
  }

  _getDeref(): Parser<any, any, any, any> {
    return this._p!._getDeref();
  }

  _parseWith(...args: any[]): never {
    throw new Error('Ref Parser ' + this._refName + ' should not be called');
  }
}

class LeftRecur<S extends K.Stream<S>, A, State, UserError> extends Parser<S, A, State, UserError> {
  constructor(private _p: Parser<S, A, State, UserError>) {
    super();
    if (_p.isNullable()) throw new Error('LeftRecur on nullable parser:' + _p.desc());
  }
  _parseWith(context: ParseCtx<S, State, UserError>): SimpleResult<A, UserError> {
    let {recurMemo, position, state} = context;
    let memoMap = recurMemo.get(this);
    if (!memoMap) {
      memoMap = new Map();
      recurMemo.set(this, memoMap);
    }

    let last = memoMap.get(position);

    if (last) {
      context.position = last.position;
      context.state = last.state;
      return last.result;
    }

    last = {
      position: position,
      state: state,
      result: {error: {position: position, parser: this}}
    };
    memoMap.set(position, last);

    while (true) {
      context.position = position;
      context.state = state;
      let result = this._p._parseWith(context);
      if (context.position <= last.position) {
        return last.result;
      } else if (!isResultOK(result)) {
        return result;
      }
      last.result = result;
      last.position = context.position;
    }
  }

  isNullable(): boolean {
    return false;
  }

  _deref(): this {
    this._p = this._p._getDeref();
    return this;
  }

  _getFirstSet() {
    return this._p._getFirstSet();
  }

  desc() {
    return 'Recur(' + this._p.desc() + ')';
  }
}

export interface GrammarMainDef<S extends K.Stream<S>, A, State, UserError> {
  Main: ParserDef<S, A, State, UserError>;
}

export type RecurParserDef<S extends K.Stream<S>, A, State, UserError> = () => Parser<S, A, State, UserError>;
export type ParserDef<S extends K.Stream<S>, A, State, UserError> =
  | Parser<S, A, State, UserError>
  | RecurParserDef<S, A, State, UserError>;

export type ParserUndef<F> = F extends (() => infer P) ? P : F extends Parser<any, any, any, any> ? F : never;

export type FilterParserField<T> = {
  [K in keyof T]: T[K] extends Function | Parser<any, any, any, any> ? K : never;
}[keyof T];

export type GrammarRuleMap<T> = {
  [K in FilterParserField<T>]: ParserUndef<T[K]>; // Distribute to ParserUndef
};

export type GrammarDefTypes<T> = $Values<GrammarRuleMap<T>> extends Parser<
  infer Stream,
  infer Result,
  infer State,
  infer UserError
>
  ? [Stream, Result, State, UserError]
  : never;

interface AnyParserDefMap {
  [refName: string]: ParserDef<any, any, any, any>;
}

const _objectPrototypePropertyNames = new Set(Object.getOwnPropertyNames(Object.prototype));
/**
 * Get object all available property names,include its prototype chain but exclude top Object.prototype
 */
function getDefRuleNames(a: any): string[] {
  let names: string[] = [];
  let proto = a;
  while (proto && proto !== Object.prototype) {
    names = names.concat(Object.getOwnPropertyNames(proto));
    proto = Object.getPrototypeOf(proto);
  }
  names = names.filter(n => !_objectPrototypePropertyNames.has(n));
  return K.sortUnique(names);
}

export class Grammar<T> {
  readonly rules: GrammarRuleMap<T>;
  private constructor(_rawDef: T) {
    let rawDef = (_rawDef as unknown) as AnyParserDefMap;

    let ruleNames = getDefRuleNames(_rawDef).filter(k => rawDef[k] instanceof Function || rawDef[k] instanceof Parser);
    let ruleMap: AnyParserMap = Object.create(null);
    let thisObject: AnyParserDefMap = Object.create(null);
    let refMap: {[ruleName: string]: Ref} = Object.create(null);

    for (let k of ruleNames) {
      let p = rawDef[k];
      if (typeof p === 'function') {
        refMap[k] = new Ref(k);
        thisObject[k] = () => refMap[k];
      } else {
        thisObject[k] = p;
      }
    }

    for (let k of ruleNames) {
      let df = rawDef[k];
      let p;
      if (typeof df === 'function') {
        p = df.call(thisObject);
        if (!(p instanceof Parser)) {
          throw new TypeError(`Grammar Definition clause "${k}" function must return Parser`);
        }
      } else {
        p = df;
      }

      if (p instanceof Parser) {
        // Allow extra utility non parser property in grammar class
        ruleMap[k] = p;
      }
    }

    let refNames = Object.getOwnPropertyNames(refMap);

    for (let k of refNames) {
      refMap[k].resolveRef(ruleMap);
    }

    for (let k of ruleNames) {
      // Fix left recursion
      let firstSet = ruleMap[k]._getFirstSet();
      let selfRef = refMap[k];
      if (firstSet.includes(selfRef)) {
        ruleMap[k] = new LeftRecur(ruleMap[k]);
      }
    }

    for (let k of refNames) {
      refMap[k].resolveRef(ruleMap);
    }

    for (let k of ruleNames) {
      ruleMap[k] = ruleMap[k]._getDeref();
    }

    this.rules = <any>ruleMap;
  }

  parseWithState: T extends GrammarMainDef<infer S, infer A, infer State, infer UserError>
    ? (s: S, initalState: State) => ParseResult<A, State, UserError>
    : never = ((s: any, initalState: any = null) => {
    let rules = this.rules as any;
    if (rules.Main) {
      return rules.Main.parse(s, initalState);
    }
  }) as any;

  parse: T extends GrammarMainDef<infer S, infer A, null, infer UserError>
    ? (s: S) => ParseResult<A, null, UserError>
    : never = this.parseWithState as any;

  static def<T>(rawDef: T): $Values<GrammarRuleMap<T>> extends Parser<any, any, any, any> ? Grammar<T> : never {
    return new Grammar(rawDef as any) as any;
  }
}

/**
We have to pre-specify these generic types due to TypeScript lacks of value polymorphism
*/
export function refine<S extends K.Stream<S>, State, UserError>() {
  const spaces = re(/\s*/);

  /**
  Parse by a custom function, it must return a consumed number in order to increase the position
  */
  function parseBy<A, _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    f: (context: {readonly input: _S; readonly position: number; readonly state: St}) => FResult<A, UErr>
  ) {
    return new FParser(f);
  }

  function getState<St = State, UErr = UserError>(): Parser<any, St, St, UErr> {
    return parseBy(ctx => ({value: ctx.state, consumed: 0}));
  }

  function re<St = State, UErr = UserError>(re: RegExp): MatchRegex<St, UErr> {
    return new MatchRegex(re);
  }

  return {
    seqs,
    alts,
    bind,
    re,
    parseBy,
    getState,
    empty: new Empty<State, UserError>(),
    eof: new EOF<State, UserError>(),
    digit: re(/\d/).slice(),
    digits: re(/\d*/).slice(),
    digits1: re(/\d+/).slice(),

    hexDigit: re(/[A-F0-9]/i).slice(),
    hexDigits: re(/[A-F0-9]*/i).slice(),
    hexDigits1: re(/[A-F0-9]+/i).slice(),

    letter: re(/[A-Z]/i).slice(),
    letters: re(/[A-Z]*/i).slice(),
    letters1: re(/[A-Z]+/).slice(),
    spaces,
    spaces1: re(/\s+/),

    pure<A, St = State, UErr = UserError>(a: A): Parser<any, A, St, UErr> {
      return parseBy(_ => ({value: a, consumed: 0}));
    },

    anyChar: new FParser<string, string, State, UserError>(ctx => {
      let cp = ctx.input.codePointAt(ctx.position);
      if (typeof cp === 'undefined') {
        return {error: 'EOF', consumed: 0};
      } else {
        let c = String.fromCodePoint(cp);
        return {
          value: c,
          consumed: c.length
        };
      }
    }),

    oneOf<St = State, UErr = UserError>(a: string): OneOf<St, UErr> {
      return new OneOf(a);
    },

    noneOf<St = State, UErr = UserError>(a: string): NoneOf<St, UErr> {
      return new NoneOf(a);
    },

    exact<_S extends K.Stream<_S> = S, St = State, UErr = UserError>(s: _S): Exact<_S, St, UErr> {
      return new Exact(s);
    },

    charset<St = State, UErr = UserError>(ch: K.Charset): CharsetParser<St, UErr> {
      return new CharsetParser(ch);
    },

    spaced<A, St = State, UErr = UserError>(p: Parser<string, A, St, UErr>): Parser<string, A, St, UErr> {
      let sp = spaces as Parser<string, any, any, any>;
      return seqs(sp, p, sp).at(1);
    },

    fails<St = State, UErr = UserError>(msg: string): Parser<any, never, St, UErr> {
      return new FailParser(msg);
    },

    failWith<St = State, UErr = UserError>(err: UErr): Parser<any, never, St, UErr> {
      return new FailParser('UserError', err);
    }
  };

  function alts(): never;
  function alts(p: any): never;
  function alts<A extends [any, any, ...any[]], _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...parsers: {[I in keyof A]: Parser<_S, A[I], St, UErr>}
  ): Alts<_S, A[number], St, UErr>;
  function alts<T, _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...parsers: Array<Parser<_S, T, St, UErr>>
  ): Alts<_S, T, St, UErr>;
  function alts<_S extends K.Stream<_S> = S, St = State, UErr = UserError>(...parsers: any): Alts<_S, any, St, UErr> {
    return new Alts(parsers);
  }

  function seqs(): never;
  function seqs(p: any): never;
  function seqs<A extends [any, any, ...any[]], _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...parsers: {[I in keyof A]: Parser<_S, A[I], St, UErr>}
  ): Seqs<_S, A, St, UErr>;
  function seqs<T, _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...parsers: Array<Parser<_S, T, St, UErr>>
  ): Seqs<_S, T[], St, UErr>;
  function seqs<_S extends K.Stream<_S> = S, St = State, UErr = UserError>(...parsers: any): Seqs<_S, any, St, UErr> {
    return new Seqs(parsers);
  }

  /**
  Let bind, we had to disperse each let binding into single object literal because of JavaScript object literal does not guarentee the order of key.
  @example
    const P = Parsec.refine<string, 'State', 'SyntaxError'>();
    let p: Parser<string, {name: string; value: number}, 'State', 'SyntaxError'> = P.bind(
      {name: P.re(/[A-Z_$]\w{0,}/i).slice()},
      {_: P.exact('=')},
      {value: P.digits1.map(Number)}
    );
  */
  function bind(): never;
  function bind<M extends [any, ...any[]], _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...bindings: {[I in keyof M]: {[K in keyof M[I]]: Parser<_S, M[I][K], St, UErr>}}
  ): Parser<_S, {[K in keyof InterU<M[number]>]: InterU<M[number]>[K]}, St, UErr>;
  function bind<A, _S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ...bindings: Array<{[k: string]: Parser<_S, A, St, UErr>}>
  ): Parser<_S, {[k: string]: A}, St, UErr>;
  function bind<_S extends K.Stream<_S> = S, St = State, UErr = UserError>(
    ..._bindings: any
  ): Parser<_S, any, St, UErr> {
    let bindings = _bindings as Array<{[k: string]: Parser<_S, any, St, UErr>}>;

    let {names, parsers} = bindings.reduce(
      (prev, cur) => {
        prev.names = prev.names.concat(Object.keys(cur));
        prev.parsers = prev.parsers.concat(Object.values(cur));

        return prev;
      },
      {names: [] as string[], parsers: [] as Array<Parser<_S, any, St, UErr>>}
    );

    let seq = new Seqs(parsers).map(values => {
      let a: {[k: string]: any} = {} as any;
      for (let i = 0; i < names.length; i++) {
        a[names[i]] = values[i];
      }
      return a;
    });

    return seq;
  }
}
