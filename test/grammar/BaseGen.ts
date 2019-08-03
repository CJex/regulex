import * as FC from 'fast-check';
import * as K from '../../src/Kit';
import {genInCharset, property, prettyPrint} from '../utils';
import {produce} from 'immer';
import * as _ from 'lodash';
import * as UnicodeProperty from '../../src/UnicodeProperty';
import {Omit} from 'utility-types';
import Unicode from '../../src/Unicode';

import * as AST from '../../src/AST';
import * as JSRE from '../../src/grammar/JSRE';
import * as GBase from '../../src/grammar/Base';

import * as path from 'path';
import * as fs from 'fs';
import {assert} from 'chai';
import {AssertionError} from 'assert';
import {Arbitrary} from 'fast-check';

export interface TestCase<T> {
  expect: T;
  source: string;
  state: GenState;
}

export type GenNode<N extends AST.Node = AST.Node> = FC.Arbitrary<TestCase<N>>;

// Avoid use DeepReadonly because of immer Draft type does not work well with ReadonlyArray
export type GenState = Readonly<{
  pos: number;
  groups: Readonly<{
    depth: number;
    count: number;
    names: string[];
  }>;
  liveGroups: Readonly<{
    indices: number[];
    names: string[];
  }>;
  liveGroupsBackup: Array<
    Readonly<{
      indices: number[];
      names: string[];
    }>
  >;
}>;

export function makeGenState(): GenState {
  return {pos: 0, groups: {depth: 0, count: 0, names: []}, liveGroups: {indices: [], names: []}, liveGroupsBackup: []};
}

export type GenFn<N extends AST.Node = AST.Expr> = (state: GenState) => GenNode<N>;

/**
"\0" + "1"  will result in OctEscape or Backref error
*/
export function isSticky(t1: TestCase<any>, t2: TestCase<any>) {
  return /\\\d*$/.test(t1.source) && /^\d/.test(t2.source);
}

export type PartialTest<N extends AST.Node = AST.Node> = Omit<TestCase<Omit<N, 'range'>>, 'state'> & {state?: GenState};

export function fixStateRange<N extends AST.Node>(initialState: GenState): (t: PartialTest<N>) => TestCase<N> {
  return t1 =>
    produce(t1 as TestCase<N>, t2 => {
      t2.state = produce(t2.state || initialState, st => void (st.pos = initialState.pos + t2.source.length));
      t2.expect.range = [initialState.pos, t2.state.pos];
    });
}

export abstract class BaseGen {
  constructor(public readonly flags: AST.RegexFlags, public readonly maxGroupDepth = 30) {}

  Dot(state: GenState): GenNode<AST.DotNode> {
    return FC.constant({
      source: '.',
      expect: {type: 'Dot' as const}
    }).map(fixStateRange(state));
  }

  Char(state: GenState): GenNode<AST.CharNode> {
    let {flags} = this;
    let UnicodeEscape = flags.unicode
      ? FC.oneof(UtilGen.BaseUnicodeEscape, UtilGen.CodePointEscape, UtilGen.UnicodePairEscape)
      : UtilGen.BaseUnicodeEscape;

    let ExactChar = flags.unicode ? UtilGen.ExactChar : UtilGen.ExactChar16;

    // Use constantFrom for better shrink result
    return FC.tuple(
      UtilGen.AlphaChar,
      UtilGen.AlphanumChar,
      ExactChar,
      UtilGen.IdentityEscape,
      UtilGen.HexEscape,
      UtilGen.ControlEscape,
      UtilGen.ControlLetter,
      UtilGen.NullChar,
      UnicodeEscape
    )
      .chain(a => FC.constantFrom(...a))
      .map(t => {
        return {
          source: t.source,
          expect: {type: 'Char' as const, value: t.expect}
        };
      })
      .map(fixStateRange(state));
  }

  CharClassEscape(state: GenState): GenNode<AST.CharClassEscapeNode> {
    let {flags} = this;
    type T = {source: string; expect: AST.BaseCharClass | AST.UnicodeCharClass};
    let gen = flags.unicode ? FC.oneof<T>(UtilGen.BaseCharClass, UtilGen.UnicodeCharClass) : UtilGen.BaseCharClass;

    return gen
      .map(t => {
        return {
          source: '\\' + t.source,
          expect: {type: 'CharClassEscape' as const, charClass: t.expect}
        };
      })
      .map(fixStateRange(state));
  }

  CharClass(state: GenState): GenNode<AST.CharClassNode> {
    type ItemF = GenFn<AST.CharClassItem>;
    let genCharItemF: GenFn<AST.CharNode> = st =>
      this.Char(st)
        .map(t1 => {
          if (!'-^'.includes(t1.source)) return t1;
          return produce(t1, t2 => {
            t2.source = '\\' + t1.source;
          });
        })
        .map(fixStateRange(st));

    let genRangeItemF: ItemF = st =>
      FC.tuple(genCharItemF(st), genCharItemF(st))
        .map(a => {
          a = produce(a, a => {
            let [c1, c2] = a.sort((t1, t2) => K.compareFullUnicode(t1.expect.value, t2.expect.value));
            AST.indent(c2.expect, c1.source.length + 1);
          });

          let source = a.map(t => t.source).join('-');
          return {
            source,
            expect: {
              type: 'CharRange' as const,
              begin: a[0].expect,
              end: a[1].expect
            }
          };
        })
        .map(fixStateRange(st));

    let genCharClassItemF = FC.constantFrom<ItemF>(genCharItemF, state => this.CharClassEscape(state), genRangeItemF);

    return FC.record({
      invert: FC.boolean(),
      bodyFns: FC.array(genCharClassItemF)
    })
      .chain(t => {
        let {invert, bodyFns} = t;
        let state1 = produce(state, st => {
          st.pos += invert ? 2 : 1;
        });
        let bodyGen = FC.constant({state: state1, source: '', expect: [] as AST.CharClassItem[]});
        for (let fn of bodyFns) {
          bodyGen = bodyGen.chain(acc => {
            return fn(acc.state).map(t2 => {
              if (isSticky(acc, t2)) return acc;
              return {
                source: acc.source + t2.source,
                state: t2.state,
                expect: acc.expect.concat(t2.expect)
              };
            });
          });
        }

        return bodyGen.map(g => {
          return {
            source: '[' + (invert ? '^' : '') + g.source + ']',
            expect: {
              type: 'CharClass' as const,
              invert,
              body: g.expect
            }
          };
        });
      })
      .map(fixStateRange(state));
  }

  BaseAssertion(state: GenState): GenNode<AST.BaseAssertionNode> {
    let symbols = Object.keys(GBase.baseAssertionTypeMap);
    return FC.constantFrom(...symbols)
      .map(source => {
        let a = GBase.baseAssertionTypeMap[source];
        return {
          source,
          expect: {type: 'BaseAssertion' as const, kind: a}
        };
      })
      .map(fixStateRange(state));
  }

  Backref(state: GenState): GenNode<AST.BackrefNode> {
    FC.pre(state.liveGroups.indices.length > 0);
    type IndexGen = FC.Arbitrary<{source: string; index: number | string}>;
    let numRef: IndexGen = FC.constantFrom(...state.liveGroups.indices).map(i => {
      return {source: '\\' + i, index: i};
    });
    let ref: IndexGen = numRef;
    if (state.liveGroups.names.length > 0) {
      let nameRef = FC.constantFrom(...state.liveGroups.names).map(n => {
        return {source: '\\k<' + n + '>', index: n};
      });
      ref = FC.oneof(numRef, nameRef);
    }

    return ref
      .map(({source, index}) => {
        return {
          source,
          expect: {type: 'Backref' as const, index}
        };
      })
      .map(fixStateRange(state));
  }

  Expr<TA extends Array<AST.Expr['type']> = []>(
    state: GenState,
    excludes?: TA
  ): GenNode<Exclude<AST.Expr, AST.NodeOfType<TA[number]>>> {
    type A = Array<AST.Expr['type']>;
    const leafGenNames: A = ['Dot', 'Char', 'CharClassEscape', 'CharClass', 'BaseAssertion'];
    const recurGenNames: A = ['GroupAssertion', 'Group', 'List', 'Disjunction', 'Repeat'];

    let names = leafGenNames.slice();
    if (state.liveGroups.indices.length > 0) {
      names.push('Backref');
    }
    if (state.groups.depth < this.maxGroupDepth) {
      names = names.concat(recurGenNames);
    }

    if (excludes) {
      names = names.filter(n => !excludes.includes(n));
    }
    return FC.constantFrom(...names).chain(fname => (this[fname] as GenFn<any>)(state));
  }

  Disjunction(state: GenState): GenNode<AST.DisjunctionNode> {
    let liveGroups0 = state.liveGroups;
    let state1 = produce(state, st => void st.liveGroupsBackup.push(st.liveGroups));

    let bodyGen = FC.integer(2, 10).chain(n => {
      let genAcc = FC.constant({source: [] as string[], expect: [] as AST.DisjunctionNode['body'], state: state1});
      while (n--) {
        genAcc = genAcc.chain(acc => {
          let state2 = produce(acc.state, st => void (st.liveGroups = liveGroups0));
          return this.Expr(state2, ['Disjunction']).map(t => {
            let newState = produce(t.state, st => {
              st.pos++;
              // merge groups in each branch when leave Disjunction
              let g = st.liveGroupsBackup.slice(-1)[0];
              g.indices.push(...st.liveGroups.indices.slice(liveGroups0.indices.length));
              g.names.push(...st.liveGroups.names.slice(liveGroups0.names.length));
            });
            return {
              state: newState,
              source: acc.source.concat(t.source),
              expect: acc.expect.concat(t.expect)
            };
          });
        });
      }
      return genAcc;
    });

    return bodyGen
      .map(t => {
        return {
          source: t.source.join('|'),
          state: produce(t.state, st => void st.liveGroupsBackup.pop()),
          expect: {
            type: 'Disjunction' as const,
            body: t.expect
          }
        };
      })
      .map(fixStateRange(state));
  }

  List(state: GenState): GenNode<AST.ListNode> {
    let genBody: Arbitrary<TestCase<AST.ListNode['body']>> = FC.integer(0, this.maxGroupDepth).chain(n => {
      let genAcc = FC.constant({source: '', state, expect: [] as AST.ListNode['body']});
      while (n--) {
        genAcc = genAcc.chain(acc => {
          return this.Expr(acc.state, ['List', 'Disjunction']).map(t => {
            if (isSticky(acc, t)) return acc;
            return {
              source: acc.source + t.source,
              state: t.state,
              expect: acc.expect.concat(t.expect)
            };
          });
        });
      }
      return genAcc.map(t => {
        if (t.expect.length === 1) {
          // When ListNode body only contains one node N, it will be unwrapped to N in parsing.
          // But here we must return a ListNode, so does the empty body
          return {source: '', state, expect: []};
        }
        return t;
      });
    });

    return genBody.map(({source, state: newState, expect: body}) => ({
      source,
      state: newState,
      expect: {type: 'List' as const, body, range: [state.pos, newState.pos]}
    }));
  }

  abstract GroupBehavior(state: GenState): Arbitrary<TestCase<AST.GroupBehavior>>;

  Group(state: GenState): GenNode<AST.GroupNode> {
    return this.GroupBehavior(produce(state, st => void st.pos++)).chain(behaviorCase => {
      let behavior = behaviorCase.expect;
      let state1 = produce(behaviorCase.state, st => {
        st.groups.depth++;
        if (behavior.type === 'Capturing') {
          st.groups.count++;
          if (behavior.name) {
            st.groups.names.push(behavior.name);
          }
        }
      });
      return this.Expr(state1).map(bodyCase => {
        let source = '(' + behaviorCase.source + bodyCase.source + ')';
        let newState = produce(bodyCase.state, st => {
          st.pos++;
          st.groups.depth--;
          if (behavior.type === 'Capturing') {
            st.liveGroups.indices.push(state1.groups.count);
            if (behavior.name) {
              st.liveGroups.names.push(behavior.name);
            }
          }
        });

        let expect: AST.GroupNode = {
          type: 'Group' as const,
          body: bodyCase.expect,
          behavior,
          range: [state.pos, newState.pos]
        };

        return {source, expect, state: newState};
      });
    });
  }

  GroupAssertion(state: GenState): GenNode<AST.GroupAssertionNode> {
    let specifierGen: FC.Arbitrary<Pick<AST.GroupAssertionNode, 'look' | 'negative'>> = FC.record({
      look: FC.constantFrom('Lookahead', 'Lookbehind'),
      negative: FC.boolean()
    });
    return specifierGen.chain(sp => {
      let liveGroupsBackup = state.liveGroups;
      let spSource = GBase.invGroupAssertionTypeMap[[sp.look, sp.negative] + ''];
      let state1 = produce(state, st => {
        st.pos += spSource.length + 1;
        st.groups.depth++;
      });
      return this.Expr(state1).map(bodyCase => {
        let newState = produce(bodyCase.state, st => {
          st.pos++;
          st.groups.depth--;
          if (sp.negative) {
            st.liveGroups = liveGroupsBackup;
          }
        });

        return {
          source: '(' + spSource + bodyCase.source + ')',
          state: newState,
          expect: {
            type: 'GroupAssertion' as const,
            look: sp.look,
            negative: sp.negative,
            body: bodyCase.expect,
            range: [state.pos, newState.pos]
          }
        };
      });
    });
  }

  Quantifier(state: GenState): GenNode<AST.QuantifierNode> {
    let baseQuantifiers = '+?*'.split('').map(c => ({source: c, expect: GBase.parseBaseQuantifier(c)}));

    return FC.record({
      greedy: FC.boolean(),
      test: FC.oneof(
        FC.constantFrom(...baseQuantifiers),
        FC.record({
          min: FC.nat(),
          max: FC.oneof(FC.nat(), FC.constant(Infinity))
        })
          .filter(({min, max}) => min <= max)
          .map(({min, max}) => {
            let q = {type: 'Quantifier', min, max, greedy: true} as AST.QuantifierNode;
            let source = GBase.showQuantifier(q);
            return {source, expect: q};
          })
      )
    })
      .map(({greedy, test}) =>
        produce(test, t => {
          t.expect.greedy = greedy;
          if (greedy === false) {
            t.source += '?';
          }
        })
      )
      .map(fixStateRange(state));
  }

  Repeat(state: GenState): GenNode<AST.RepeatNode> {
    return this.Expr(state, ['Repeat', 'BaseAssertion', 'GroupAssertion', 'List', 'Disjunction']).chain(bodyCase => {
      return this.Quantifier(bodyCase.state).map(q => ({
        source: bodyCase.source + q.source,
        state: q.state,
        expect: {
          type: 'Repeat' as const,
          quantifier: q.expect,
          body: bodyCase.expect,
          range: [state.pos, q.state.pos]
        }
      }));
    });
  }
}

export module UtilGen {
  export const unicode16 = K.Charset.fromPattern('\0-\uFFFF');

  export const patternChar = K.Charset.fromChars(GBase.syntaxChars).inverted();
  export const patternChar16 = patternChar.intersect(unicode16);
  export const alphanum = K.Charset.fromPattern('A-Za-z0-9');
  export const alpha = K.Charset.fromPattern('A-Za-z');

  export const Flags = FC.constant(AST.RegexFlags.create({unicode: true}));

  export const ExactChar16 = genInCharset(patternChar16).map(c => ({source: c, expect: c}));
  export const ExactChar = genInCharset(patternChar).map(c => ({source: c, expect: c}));
  export const AlphaChar = genInCharset(alpha).map(c => ({source: c, expect: c}));
  export const AlphanumChar = genInCharset(alphanum).map(c => ({source: c, expect: c}));

  export const HexEscape = FC.char().map(c => ({source: K.Char.hexEscape(c), expect: c}));
  export const ControlEscape = FC.constantFrom(...'fnrtv').map(c => ({
    source: '\\' + c,
    expect: GBase.controlEscapeMap[c]
  }));
  export const ControlLetter = genInCharset(alpha).map(c => ({
    source: '\\c' + c,
    expect: K.Char.ctrl(c)
  }));

  export const NullChar = FC.constant({source: '\\0', expect: '\0'});

  export const BaseUnicodeEscape = FC.unicode().map(c => ({source: K.Char.unicodeEscape(c), expect: c}));
  export const CodePointEscape = FC.fullUnicode().map(c => ({source: K.Char.codePointEscape(c), expect: c}));
  export const UnicodePairEscape = FC.integer(0x10000, K.Char.MAX_CODE_POINT).map(cp => {
    let c = String.fromCodePoint(cp);
    return {source: K.escapeUnicodes(c, false), expect: c};
  });

  export const IdentityEscape = FC.constantFrom(...(GBase.syntaxChars + '/')).map(c => ({source: '\\' + c, expect: c}));

  export const BaseCharClass = FC.constantFrom(
    ...Object.entries(GBase.charClassEscapeTypeMap).map(a => ({source: a[0], expect: a[1]}))
  );

  export const BinaryUnicodeCharClass: FC.Arbitrary<AST.UnicodeCharClass> = FC.constantFrom(
    ...UnicodeProperty.canonical.Binary_Property
  ).map(name => ({name, invert: false}));

  export const NonBinaryUnicodeCharClass: FC.Arbitrary<AST.UnicodeCharClass> = FC.constantFrom(
    ...UnicodeProperty.canonical.NonBinary_Property
  ).chain(name =>
    FC.constantFrom(...K.IndexSig(UnicodeProperty.canonical)[name]).map(value => ({name, value, invert: false}))
  );

  export const UnicodeCharClass = FC.record({
    invert: FC.boolean(),
    cat: FC.oneof(BinaryUnicodeCharClass, NonBinaryUnicodeCharClass)
  })
    .map(c => produce(c.cat, a => void (a.invert = c.invert)))
    .chain(cat =>
      FC.constantFrom(...getAliasForms(cat).map(s => ({source: (cat.invert ? 'P' : 'p') + '{' + s + '}', expect: cat})))
    );

  const invAliasMap = K.invertMap(UnicodeProperty.aliasMap);
  export function getAliasForms(cat: AST.UnicodeCharClass): string[] {
    let toCode = (name: string, value?: string) => name + (value ? '=' + value : '');
    let forms = [toCode(cat.name, cat.value)];
    let nameAlias = invAliasMap.get(cat.name);
    let valueAlias = cat.value && invAliasMap.get(cat.value);
    if (nameAlias) {
      forms.push(toCode(nameAlias, cat.value));
      if (valueAlias) {
        forms.push(toCode(nameAlias, valueAlias));
      }
    }
    if (valueAlias) {
      forms.push(toCode(cat.name, valueAlias));
    }

    return forms;
  }

  export const ID = {
    Start: genInCharset(Unicode.Binary_Property.ID_Start),
    Continue: genInCharset(Unicode.Binary_Property.ID_Continue)
  };

  export const ID16Bit = {
    Start: genInCharset(Unicode.Binary_Property.ID_Start.intersect(unicode16)),
    Continue: genInCharset(Unicode.Binary_Property.ID_Continue.intersect(unicode16))
  };
}

export function cleanNodeRange(node: AST.Node): void {
  AST.visit(node, {
    defaults(n) {
      n.range = [0, 0];
    }
  });
}

export function runGrammarTest(
  title: string,
  parse: typeof JSRE.parse,
  gen: Arbitrary<{flags: AST.RegexFlags; testCase: TestCase<AST.Node>}>
) {
  let runProp = property(gen, ({testCase, flags}) => {
    let result = parse(testCase.source, flags);
    if (!K.isResultOK(result)) {
      assert(K.isResultOK(result));
      return;
    }
    assert.deepEqual(result.value.expr, testCase.expect, K.escapeUnicodes(testCase.source));

    // Test toSource parse idempotency
    let cleanExpr = _.cloneDeep(testCase.expect);
    cleanNodeRange(cleanExpr);
    let source2 = GBase.toSource(cleanExpr);
    let result2 = parse(source2, flags);

    if (!K.isResultOK(result2)) {
      assert(K.isResultOK(result2));
      return;
    }

    cleanNodeRange(result2.value.expr);
    assert.deepEqual(cleanExpr, result2.value.expr, K.escapeUnicodes(source2));
  });

  it(title, () => {
    try {
      runProp();
    } catch (e) {
      if (e instanceof AssertionError) {
        let errorLog = './test/log/grammar/' + path.basename(__filename);
        fs.mkdirSync('./test/log/grammar/', {recursive: true});
        fs.writeFileSync(
          errorLog,
          'export const expected = ' +
            prettyPrint(e.expected) +
            ';\n' +
            'export const actual = ' +
            prettyPrint(e.actual) +
            ';\n'
        );
        console.error('See error log:' + errorLog);
      }

      throw e;
    }
  });
}
