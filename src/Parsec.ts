import * as K from './Kit';
import {Err, Result, isResultOK} from './Kit';

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

class ParseCtx<S extends K.Stream<S[0]>, State, UserError> {
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

export abstract class Parser<S extends K.Stream<S[0]>, A, State, UserError> {
  /**
  Map result value. Changing state in the map function is allowed, ensure yourself the parser is unrecoverable.
  (Why that? Because we don't have *REAL* immutable data type.)
  */
  map<B>(f: (v: A, ctx: TokenCtx<S, State>) => B): MapF<S, any, B, State, UserError> {
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
  mapE<B>(f: (v: A, ctx: TokenCtx<S, State>) => Result<B, UserError>): MapF<S, any, B, State, UserError> {
    let p: MapF<S, any, B, State, UserError> = MapF.compose(
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
  ): MapF<S, any, B, State, UserError> {
    return MapF.compose(
      this,
      f
    );
  }

  /**
  Map result UserError
  */
  mapError(f: (err: UserError) => UserError): MapF<S, any, A, State, UserError> {
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

  opt(): Optional<S, A, State, UserError> {
    return new Optional(this);
  }

  trys(): TryParser<S, A, State, UserError> {
    return new TryParser(this);
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
export class FParser<S extends K.Stream<S[0]>, A, State, UserError> extends Parser<S, A, State, UserError> {
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

class MapF<S extends K.Stream<S[0]>, A, B, State, UserError> extends Parser<S, B, State, UserError> {
  constructor(
    private _p: Parser<S, A, State, any>,
    private _f: (v: SimpleResult<A, UserError>, ctx: TokenCtx<S, State>) => SimpleResult<B, UserError>
  ) {
    super();
  }

  static compose<S extends K.Stream<S[0]>, A, B, State, UserError>(
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

export class StateF<S extends K.Stream<S[0]>, A, State, UserError> extends Parser<S, A, State, UserError> {
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

export class Optional<S extends K.Stream<S[0]>, A, State, UserError> extends Parser<S, K.Maybe<A>, State, UserError> {
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

export class TryParser<S extends K.Stream<S[0]>, A, State, UserError> extends Parser<S, A, State, UserError> {
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
