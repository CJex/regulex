import {refine, Parser, TokenRange} from '../Parsec';
import * as K from '../Kit';
import {OK, Err, Charset} from '../Kit';
import Unicode from '../Unicode';
import * as UnicodeProperty from '../UnicodeProperty';
import * as AST from '../AST';
import {Omit} from 'utility-types';
import * as Parsec from '../Parsec';

export {TokenRange} from '../Parsec';

export type RawLexeme = {
  type: 'VBar' | 'Paren' | 'CharClassBracket' | 'GroupBehavior' | 'GroupAssertionBehavior';
  range: TokenRange;
};

export type Lexeme = AST.LeafNode | AST.CharRangeNode | RawLexeme;

export type RegexError = {
  type:
    | 'SyntaxError'
    | 'ParenMismatch'
    | 'OctEscape'
    | 'IdentityEscape'
    | 'NothingToRepeat'
    | 'CharClassEscapeB'
    | 'CharClassEscapeInRange'
    | 'UnicodeEscape'
    | 'UnicodeIDEscape'
    | 'BackrefNotExist'
    | 'BackrefEmpty'
    | 'DupGroupName'
    | 'QuantifierOutOfOrder'
    | 'CharRangeOutOfOrder'
    | 'Identifier'
    | 'UnicodePropertyName'
    | 'UnicodePropertyValue';
  // A more precise error range
  range: TokenRange;
};

export type RegexParseState = {
  flags: AST.RegexFlags;
  features: {
    legacy: Partial<{
      octalEscape: boolean;
      identityEscape: boolean;
      charClassEscapeInCharRange: boolean;
    }>;
  };
  loose?: boolean;
  // Previous unclosed open paren or bracket positions
  openPairs: number[];
};

export type RegexParser<T> = Parser<string, T, RegexParseState, RegexError>;

export type RegexParseResult = K.Result<AST.Regex, RegexError>;

export const lineTerms = '\n\r\u2028\u2029';
export const syntaxChars = '^$\\.*+?()[]{}|/';
export const controlEscapeMap: {[c: string]: string} = {
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v'
};

export const charClassEscapeTypeMap: {[c: string]: AST.BaseCharClass} = {
  s: 'Space',
  S: 'NonSpace',
  d: 'Digit',
  D: 'NonDigit',
  w: 'Word',
  W: 'NonWord'
};

export const baseAssertionTypeMap: {[k: string]: AST.BaseAssertionType} = {
  '\\b': 'WordBoundary',
  '\\B': 'NonWordBoundary',
  '^': 'Begin',
  $: 'End'
};

export const groupAssertionTypeMap: Record<
  string,
  [AST.GroupAssertionNode['look'], AST.GroupAssertionNode['negative']]
> = {
  '?=': ['Lookahead', false],
  '?!': ['Lookahead', true],
  '?<=': ['Lookbehind', false],
  '?<!': ['Lookbehind', true]
};

export const invCharClassEscapeTypeMap = K.invertRecord(charClassEscapeTypeMap);
export const invBaseAssertionTypeMap = K.invertRecord(baseAssertionTypeMap);
export const invGroupAssertionTypeMap = K.invertRecord(groupAssertionTypeMap);

/** Parse "*,+,?" with optional non greedy mark "?" */
export function parseBaseQuantifier(q?: string): AST.QuantifierNode {
  let a = {type: 'Quantifier' as const, min: 0, max: Infinity, greedy: true, range: [0, 0] as [number, number]};
  if (!q) return a;
  if (q[0] === '?') {
    a.max = 1;
  } else if (q[0] === '+') {
    a.min = 1;
  }
  if (q[1] === '?') {
    a.greedy = false;
  }
  return a;
}

export function showQuantifier(n: Omit<AST.QuantifierNode, 'range'>) {
  let q = '';
  if (n.min === 0 && n.max === 1) {
    q = '?';
  } else if (n.min === 0 && n.max === Infinity) {
    q = '*';
  } else if (n.min === 1 && n.max === Infinity) {
    q = '+';
  } else if (n.max === Infinity) {
    q = '{' + n.min + ',}';
  } else if (n.min === n.max) {
    q = '{' + n.min + '}';
  } else {
    q = '{' + n.min + ',' + n.max + '}';
  }

  if (n.greedy === false) {
    q += '?';
  }
  return q;
}

export const IDCharset = {
  ID_Start: Unicode.Binary_Property.ID_Start.union(Charset.fromChars('$_')),
  // ZWJ = \u200D; ZWNJ = \u200C
  ID_Continue: Unicode.Binary_Property.ID_Continue.union(Charset.fromChars('$_\u200C\u200D'))
};

export const IDRegex = new RegExp(
  '^' + IDCharset.ID_Start.toRegex().source + IDCharset.ID_Continue.toRegex().source + '*$',
  'u'
);

export function asNode<T extends AST.NodeBase>(type?: T['type']) {
  return function(v: Omit<T, 'range' | 'type'>, ctx: {range: TokenRange}): T {
    let a = v as any;
    if (!a.type && type) {
      a.type = type;
    }
    a.range = ctx.range;
    return a;
  };
}

const P = refine<string, RegexParseState, RegexError>();

/** Base Regex Grammar Definition */
export abstract class BaseGrammar {
  Char = P.parseBy<AST.CharNode>(ctx => {
    const _charRegex = /[^$^\\.*+?()[{|]/y;
    const _unicodeCharRegex = /[^$^\\.*+?()[{|]/uy;

    let re = ctx.state.flags.unicode ? _unicodeCharRegex : _charRegex;
    re.lastIndex = ctx.position;
    let m = re.exec(ctx.input);
    if (m === null) {
      return {error: true, consumed: 0};
    }
    let c = m[0];
    return {value: {type: 'Char', value: c, range: [ctx.position, ctx.position + c.length]}, consumed: c.length};
  });

  Dot = P.exact('.').map((_, ctx) => asNode<AST.DotNode>('Dot')({}, ctx));

  BaseCharClassEscape = P.re(/\\([dDsSwW])/).map((m, ctx) =>
    asNode<AST.CharClassEscapeNode>('CharClassEscape')({charClass: charClassEscapeTypeMap[m[1]]}, ctx)
  );

  RawUnicodeCharClassEscape = P.re(/\\(p)\{([^{}=]*)(?:=([^{}]*))?\}/i);

  UnicodeCharClassEscape = this.RawUnicodeCharClassEscape.mapE<AST.UnicodeCharClass>((m, ctx) => {
    let loose = ctx.state.loose;
    let invert = m[1] === 'P';
    let name = m[2];
    let value = m[3];

    function makeError(t: RegexError['type'], range: TokenRange): K.Result<AST.UnicodeCharClass, RegexError> {
      if (loose) {
        return K.OK({name, invert, value});
      }
      return {error: {type: t, range}};
    }

    if (!name) return makeError('UnicodePropertyName', [ctx.range[0] + 2, ctx.range[1] - 1]);

    name = UnicodeProperty.aliasMap.get(name) || name;
    if (value) {
      value = UnicodeProperty.aliasMap.get(value) || value;
      if (!UnicodeProperty.RawAliasData.NonBinary_Property.hasOwnProperty(name)) {
        return makeError('UnicodePropertyName', [ctx.range[0] + 2, ctx.range[0] + 2 + m[2].length]);
      }
      let unicodePropValues = (UnicodeProperty.canonical as any)[name];
      if (!unicodePropValues.has(value)) {
        return makeError('UnicodePropertyValue', [ctx.range[0] + 3 + m[2].length, ctx.range[1] - 1]);
      }
      return K.OK({name, value, invert});
    } else {
      if (UnicodeProperty.canonical.Binary_Property.has(name)) {
        return K.OK({name, invert});
      } else if (UnicodeProperty.canonical.General_Category.has(name)) {
        return K.OK({name: 'General_Category', value: name, invert});
      } else {
        return makeError('UnicodePropertyValue', [ctx.range[0] + 2, ctx.range[1] - 1]);
      }
    }
  }).map((cat, ctx) => asNode<AST.CharClassEscapeNode>('CharClassEscape')({charClass: cat}, ctx));

  NullCharEscape = P.re(/\\0(?=\D|$)/).map((_, ctx) => asNode<AST.CharNode>('Char')({value: '\0'}, ctx));

  DecimalEscape = P.alts(
    P.re(/\\([1-9]\d*)/).mapE((m, ctx) => {
      let index = +m[1];
      return {value: asNode<AST.BackrefNode>('Backref')({index}, ctx)};
    }),
    this.NullCharEscape,
    P.re(/\\(0\d+)/).mapE<AST.CharNode>((m, ctx) => {
      if (ctx.state.features.legacy.octalEscape) {
        return {value: asNode<AST.CharNode>('Char')({value: String.fromCharCode(parseInt(m[1], 8))}, ctx)};
      }
      return {error: {type: 'OctEscape', range: ctx.range}};
    })
  );

  /*
    Full unicode atom /^\u{1F437}+$/u == /^\uD83D\uDC37+$/u , match  "🐷🐷🐷".
    Isolated Unicode LeadSurrogate or TrailSurrogate only match char not follow or followed by Surrogate.
    But /^\u{D83D}\u{DC37}$/u never match anthing, any char specified by /\u{CodePoint}/ form always be regarded as single char even consecutive surrogates wont be merged.
  */
  RegExpUnicodeEscapeSequence = P.parseBy<string>(ctx => {
    let unicodeMode = ctx.state.flags.unicode;
    /*
    \u LeadSurrogate \u TrailSurrogate
    /\\u(D[89AB][0-9A-F]{2})\\u(D[CDEF][0-9A-F]{2})/i

    \u{CodePoint} or \u Hex4Digits (include isolated Lead or Tail Surrogate)
    /\\u\{([0-9A-F]+)\}|\\u([0-9A-F]{4})/i
    */
    let re = unicodeMode
      ? /\\u(D[89AB][0-9A-F]{2})\\u(D[CDEF][0-9A-F]{2})|\\u\{([0-9A-F]+)\}|\\u([0-9A-F]{4})/iy
      : /\\u([A-F0-9]{4})/iy;
    re.lastIndex = ctx.position;
    let m = re.exec(ctx.input);
    if (m === null) {
      return {error: true, consumed: 0};
    }
    let a: any = makeUnicodeEscape(...m.slice(1).filter(Boolean));
    if (a.error) {
      a.error.range = [ctx.position, ctx.position + m[0].length];
    }
    a.consumed = m[0].length;
    return a;
  });

  ID_Start = P.charset(IDCharset.ID_Start);
  ID_Continue = P.charset(IDCharset.ID_Continue);

  RegExpIdentifierStart = P.alts(
    this.ID_Start,
    this.RegExpUnicodeEscapeSequence.mapE(checkIDEscape(IDCharset.ID_Start))
  );

  RegExpIdentifierContinue = P.alts(
    this.ID_Continue,
    this.RegExpUnicodeEscapeSequence.mapE(checkIDEscape(IDCharset.ID_Continue))
  );

  RegExpIdentifierName = P.seqs(this.RegExpIdentifierStart, this.RegExpIdentifierContinue.repeat()).map(a => {
    return a[0] + a[1].join('');
  });

  CharEscape = P.alts(
    P.re(/\\([fnrtv])/).map(m => controlEscapeMap[m[1]]),
    /* ControlLetter */
    P.re(/\\c([A-Z])/i).map(m => K.Char.ctrl(m[1])),
    /* HexEscapeSequence */
    P.re(/\\(x[A-F0-9][A-F0-9])/i).map(m => String.fromCharCode(parseInt('0' + m[1], 16))),
    this.RegExpUnicodeEscapeSequence,

    /* IdentityEscape */
    P.re(/\\(.)/s).mapE((m, ctx) => {
      let unicodeMode = ctx.state.flags.unicode;
      let c = m[1];
      if (!ctx.state.features.legacy.identityEscape && unicodeMode && !syntaxChars.includes(c)) {
        return K.Err({type: 'IdentityEscape', range: ctx.range});
      } else {
        return {value: c};
      }
    })
  ).map((c, ctx) => asNode<AST.CharNode>('Char')({value: c}, ctx));

  CharClassEscape = P.alts(this.BaseCharClassEscape, this.UnicodeCharClassEscape);

  CharClass() {
    return P.seqs(P.exact('^').opt(), this.CharClassRanges())
      .betweens('[', ']')
      .map(([sign, ranges], ctx) => asNode<AST.CharClassNode>('CharClass')({invert: !!sign, body: ranges}, ctx));
  }

  CharClassRanges() {
    return this.CharClassAtom()
      .repeat()
      .mapE<AST.CharClassItem[]>((ranges, ctx) => {
        let allowCharClassEscapeInCharRange = ctx.state.features.legacy.charClassEscapeInCharRange;
        let stack: Array<AST.CharClassItem> = [];
        let prevHyphen = false;
        for (let r of ranges) {
          let hyphen = r.type === 'Char' && ctx.input.slice(...r.range) === '-';

          let prev = stack[stack.length - 2];
          if (!prevHyphen || stack.length === 1 || prev.type === 'CharRange') {
            // Case: [-a], [a-c-f] at "f"
            prevHyphen = hyphen;
            stack.push(r);
            continue;
          }

          prevHyphen = hyphen;

          let begin = prev;
          let end = r;
          if (begin.type === 'CharClassEscape' || end.type === 'CharClassEscape') {
            if (allowCharClassEscapeInCharRange) {
              stack.push(r);
              continue;
            }
            return {
              error: {
                type: 'CharClassEscapeInRange',
                range: (begin.type === 'CharClassEscape' ? begin : end).range
              }
            };
          }

          if (K.compareFullUnicode(begin.value, end.value) > 0) {
            if (ctx.state.loose) {
              stack.push(end);
              continue;
            }
            return {
              error: {
                type: 'CharRangeOutOfOrder',
                range: [begin.range[0], end.range[1]]
              }
            };
          }

          stack.length -= 2; // pop hyphen and prev

          stack.push({type: 'CharRange', begin, end, range: [begin.range[0], end.range[1]]});
        }
        return OK(stack);
      });
  }

  CharClassAtom() {
    const specialChars: {[k: string]: string} = {'\\b': '\x08', '\\-': '-', '\\0': '\0', '\\B': 'B'};
    const _classAtomRegex = /\\[bB0-]|[^\\\]]/y;
    const _unicodeClassAtomRegex = new RegExp(_classAtomRegex.source, 'uy');
    return P.alts(
      P.parseBy<AST.CharNode>(ctx => {
        let re = ctx.state.flags.unicode ? _unicodeClassAtomRegex : _classAtomRegex;
        re.lastIndex = ctx.position;
        let m = re.exec(ctx.input);
        if (m === null) {
          return {error: true, consumed: 0};
        }
        let s = m[0];
        let consumed = s.length;
        let range = [ctx.position, ctx.position + consumed];
        if (s === '\\B' && !ctx.state.loose) {
          return {error: {type: 'CharClassEscapeB', range} as RegexError, consumed};
        }
        s = specialChars[s] || s;
        return {value: {type: 'Char', value: s, range: range} as AST.CharNode, consumed};
      }),
      P.alts(this.CharClassEscape, this.CharEscape)
    );
  }

  Quantifier: RegexParser<AST.QuantifierNode> = P.re(/(?:{(\d+)(,(\d+)?)?}|([*+?]))\??/).mapE((m, ctx) => {
    let toQNode = (q: Omit<AST.QuantifierNode, 'range'>) => OK(asNode<AST.QuantifierNode>('Quantifier')(q, ctx));
    if (m[4]) return toQNode(parseBaseQuantifier(m[0]));
    let [_, mins, c, maxs] = m;
    let r = parseBaseQuantifier();
    r.min = +mins;
    if (c === undefined) {
      r.max = r.min;
    } else if (maxs !== undefined) {
      r.max = +maxs;
    }

    if (r.min > r.max && !ctx.state.loose) {
      return {error: {type: 'QuantifierOutOfOrder', range: ctx.range}};
    }

    if (m[0].slice(-1) === '?') {
      r.greedy = false;
    }

    return toQNode(r);
  });

  BaseAssertion = P.re(/\^|\$|\\b|\\B/).map((m, ctx) => {
    return asNode<AST.BaseAssertionNode>('BaseAssertion')({kind: baseAssertionTypeMap[m[0]]}, ctx);
  });

  GroupAssertionBehavior = P.alts(...Object.keys(groupAssertionTypeMap).map(s => P.exact('(' + s))).map(
    (prefix, ctx) => {
      let [look, negative] = groupAssertionTypeMap[prefix.slice(1)];
      ctx.state.openPairs.push(ctx.range[0]);
      return {assertion: <Omit<AST.GroupAssertionNode, 'body'>>{look, negative}};
    }
  );

  openParen = P.exact('(').stateF((st, ctx) => {
    st.openPairs.push(ctx.range[0]);
    return st;
  });

  closeParen = P.alts(P.exact(')'), P.eof).mapE((s, ctx) => {
    // Not reentrant path, it's safe to modifiy state
    let pos = ctx.state.openPairs.pop();
    if (s === undefined) {
      return {error: {type: 'ParenMismatch', range: [pos, pos]}} as Err<RegexError>;
    }
    return {value: s};
  });

  abstract Term(): RegexParser<AST.ListNode['body'][number]>;

  Disjunction(): RegexParser<AST.Expr> {
    // Disjunction

    function toNodeList<T extends AST.ListNode['body'][number]>(nodes: T[]): T | AST.ListNode {
      if (nodes.length === 1) {
        return nodes[0];
      } else {
        return asNode<AST.ListNode>('List')(
          {body: nodes},
          {range: [nodes[0].range[0], nodes[nodes.length - 1].range[1]]}
        );
      }
    }

    return P.seqs(
      this.Term()
        .many()
        .map((terms, ctx) => (terms.length ? toNodeList(terms) : AST.makeEmptyNode(ctx.range[0]))),
      P.seqs(P.exact('|'), this.Disjunction()).opt()
    ).map((v, ctx) => {
      let [left, remain] = v;
      let right = remain ? remain[1] : undefined;
      if (right) {
        let body = right.type === 'Disjunction' ? [left, ...right.body] : [left, right];
        return asNode<AST.DisjunctionNode>('Disjunction')({body}, ctx);
      } else {
        return left;
      }
    });
  }
}

export function check(re: AST.Node): K.Maybe<RegexError> {
  let totalGroups = AST.renumberGroups(re);
  type GroupEnv = {names: string[]; indices: number[]};
  type EnvBackup = {namesLength: number; indicesLength: number};
  let groupEnv: GroupEnv = {names: [], indices: []};

  let regexError: K.Maybe<RegexError>;

  function backupEnv(): EnvBackup {
    return {indicesLength: groupEnv.indices.length, namesLength: groupEnv.names.length};
  }

  function restoreEnv(backup: EnvBackup) {
    groupEnv.indices.length = backup.indicesLength;
    groupEnv.names.length = backup.namesLength;
  }

  try {
    _check(re);
  } catch (e) {
    if (regexError) {
      return regexError;
    }
    throw e;
  }

  function _check(node: AST.Node) {
    AST.match(node, {
      Backref(n) {
        let errType: K.Maybe<RegexError['type']>;
        if (typeof n.index === 'number') {
          if (n.index > totalGroups.count) {
            errType = 'BackrefNotExist';
          } else if (!groupEnv.indices.includes(n.index)) {
            errType = 'BackrefEmpty';
          }
        } else {
          if (!totalGroups.names.has(n.index)) {
            errType = 'BackrefNotExist';
          } else if (!groupEnv.names.includes(n.index)) {
            errType = 'BackrefEmpty';
          }
        }

        if (errType) {
          regexError = {type: errType, range: n.range};
          throw null;
        }
      },
      Group(n) {
        _check(n.body);
        if (n.behavior.type === 'Capturing') {
          groupEnv.indices.push(n.behavior.index);
          if (n.behavior.name) {
            groupEnv.names.push(n.behavior.name);
          }
        }
      },
      GroupAssertion(n) {
        if (n.negative) {
          let backup = backupEnv();
          _check(n.body);
          restoreEnv(backup);
        } else {
          _check(n.body);
        }
      },
      Disjunction(n) {
        let backup = backupEnv();
        let merged = {names: groupEnv.names.slice(), indices: groupEnv.indices.slice()};
        n.body.forEach(a => {
          _check(a);
          merged.names.push(...groupEnv.names.slice(backup.namesLength));
          merged.indices.push(...groupEnv.indices.slice(backup.indicesLength));
          restoreEnv(backup);
        });
        groupEnv = merged;
      },
      List(n) {
        n.body.forEach(_check);
      },
      Repeat(n) {
        _check(n.body);
      },
      defaults(n) {}
    });
  }
}

function checkIDEscape(ch: Charset): (c: string, ctx: {range: TokenRange}) => K.Result<string, RegexError> {
  return (c, ctx) => {
    if (ch.includeChar(c)) {
      return {value: c};
    } else {
      return {error: {type: 'UnicodeIDEscape', range: ctx.range}};
    }
  };
}

function makeUnicodeEscape(...points: string[]): K.Result<string, Omit<RegexError, 'range'>> {
  let codePoints = points.map(c => parseInt('0x' + c, 16));
  let c;
  try {
    c = String.fromCodePoint.apply(String, codePoints);
    return K.OK(c);
  } catch (e) {
    // CodePoint out of range
    return {error: {type: 'UnicodeEscape'}};
  }
}

/**
Convert Regex Node to source string
*/
export function toSource(node: AST.Node): string {
  return AST.bottomUp<string>(node, (n, parent) => {
    function escape(node: AST.CharNode) {
      let s = K.escapeRegex(node.value, parent && (parent.type === 'CharRange' || parent.type === 'CharClass'));
      const escapes: {[k: string]: string} = {
        '\f': '\\f',
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t'
      };
      const re = /[\b\f\n\r\t\u2028\u2029\uD800-\uDBFF\uDC00-\uDFFF]/g;
      s = s.replace(re, c => {
        let e = escapes[c];
        if (e) return e;
        return K.escapeUnicodes(c, false);
      });
      return s;
    }

    function fixStickyDecimalEscape(a: string[]): string {
      return a
        .reduce(
          (prev, cur) => {
            let end = prev[prev.length - 1];
            if (end && /\\\d*$/.test(end) && /^\d/.test(cur)) {
              prev.push(K.Char.hexEscape(cur[0]), cur.slice(1));
            } else {
              prev.push(cur);
            }
            return prev;
          },
          [] as string[]
        )
        .join('');
    }

    return AST.match<string, string>(n, {
      Char: escape,
      Dot: _ => '.',
      CharRange(n) {
        return n.begin + '-' + n.end;
      },
      CharClass(n) {
        return '[' + (n.invert ? '^' : '') + fixStickyDecimalEscape(n.body) + ']';
      },
      CharClassEscape(n) {
        if (typeof n.charClass === 'string') {
          return '\\' + invCharClassEscapeTypeMap[n.charClass];
        } else {
          let cat = n.charClass;
          let p = cat.invert ? 'P' : 'p';
          return '\\' + p + '{' + cat.name + (cat.value ? '=' + cat.value : '') + '}';
        }
      },
      Backref(n) {
        if (typeof n.index === 'string') {
          return '\\k<' + n.index + '>';
        } else {
          return '\\' + n.index;
        }
      },
      GroupAssertion(n) {
        let prefix = invGroupAssertionTypeMap[[n.look, n.negative] + ''];
        return '(' + prefix + n.body + ')';
      },
      BaseAssertion(n) {
        return invBaseAssertionTypeMap[n.kind];
      },
      Group(n) {
        let specifier = '';
        if (n.behavior.type === 'NonCapturing') {
          specifier = '?:';
        } else if (n.behavior.type === 'Capturing' && n.behavior.name) {
          specifier = '?<' + n.behavior.name + '>';
        }
        return '(' + specifier + n.body + ')';
      },
      Repeat(n) {
        return n.body + n.quantifier;
      },
      Quantifier: showQuantifier,
      List(n) {
        return fixStickyDecimalEscape(n.body);
      },
      Disjunction(n) {
        return n.body.join('|');
      }
    });
  });
}
