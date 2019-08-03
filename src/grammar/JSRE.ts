import {refine, Grammar, TokenRange} from '../Parsec';
import * as K from '../Kit';
import * as AST from '../AST';
import {
  RegexParseState,
  RegexError,
  RegexParser,
  BaseGrammar,
  asNode,
  Lexeme,
  RawLexeme,
  check,
  RegexParseResult,
  groupAssertionTypeMap
} from './Base';

const P = refine<string, RegexParseState, RegexError>();

/** JavaScript Regular Expression Grammar */
export class JSREGrammar extends BaseGrammar {
  Main(): RegexParser<AST.Expr> {
    return this.Disjunction();
  }

  Term() {
    return P.alts(
      this.Assertion()
        .and(this.Quantifier.opt())
        .mapE((a, ctx) => {
          if (a[1]) {
            return {error: {type: 'NothingToRepeat', range: ctx.range}} as K.Err<RegexError>;
          }
          return {value: a[0]};
        }),
      this.Repeat(),
      this.Quantifier.mapE((a, ctx) => {
        return {error: {type: 'NothingToRepeat', range: ctx.range}} as K.Result<never, RegexError>;
      })
    );
  }
  Repeat(): RegexParser<AST.AtomNode | AST.RepeatNode> {
    return this.Atom()
      .and(this.Quantifier.opt())
      .map((a, ctx) => {
        let [body, quantifier] = a;
        if (!quantifier) return body;
        return asNode<AST.RepeatNode>('Repeat')({quantifier, body}, ctx);
      });
  }
  Assertion(): RegexParser<AST.AssertionNode> {
    return P.alts(
      this.BaseAssertion,
      P.seqs(this.GroupAssertionBehavior, this.Main(), this.closeParen).map((a, ctx) => {
        let group = a[0].assertion as AST.GroupAssertionNode;
        let body = a[1];
        group.body = body;
        return asNode<AST.GroupAssertionNode>('GroupAssertion')(group, ctx);
      })
    );
  }

  Atom(): RegexParser<AST.AtomNode> {
    return P.alts(this.Char, this.Dot, this.AtomEscape(), this.CharClass(), this.Group());
  }

  AtomEscape() {
    return P.alts(this.DecimalEscape, this.GroupNameBackref, this.CharClassEscape, this.CharEscape);
  }

  Group() {
    return P.bind({behavior: this.GroupBehavior()}, {body: this.Main()})
      .between(this.openParen, this.closeParen)
      .map(asNode<AST.GroupNode>('Group'));
  }

  GroupName = this.RegExpIdentifierName.betweens('<', '>');

  GroupNameBackref = P.exact('\\k')
    .thenR(this.GroupName)
    .mapE((name, ctx) => {
      return {value: asNode<AST.BackrefNode>('Backref')({index: name}, ctx)};
    });

  GroupBehavior(): RegexParser<AST.GroupBehavior> {
    return P.alts(
      P.exact('?:').map(_ => ({type: 'NonCapturing' as const})),
      P.exact('?')
        .thenR(this.GroupName)
        .opt()
        .map(name => (name ? {type: 'Capturing' as const, index: 0, name} : {type: 'Capturing' as const, index: 0}))
    );
  }

  /** This loose mode lexer is not used in strict whole parsing */
  Lexer(): RegexParser<Lexeme[]> {
    const asLexeme = (type: RawLexeme['type']) => (_: any, {range}: {range: TokenRange}) =>
      ({type, range} as RawLexeme);
    let asBracket = asLexeme('CharClassBracket');
    let asParen = asLexeme('Paren');

    return P.alts(
      P.exact('|').map(asLexeme('VBar')),
      P.exact(']').map(asBracket),
      P.exact(')').map(asParen),
      P.alts(this.Char, this.Dot, this.BaseAssertion, this.AtomEscape().trys()),

      P.exact('[')
        .map(asBracket)
        .and(this.CharClassRanges())
        .map(a => ([a[0]] as Lexeme[]).concat(a[1])),

      P.exact('(')
        .map(asParen)
        .and(
          P.alts(
            P.re(/\?(:|<[^<>]*>)/)
              .slice()
              .map((_, ctx) => ({type: 'GroupBehavior' as const, range: ctx.range})),
            P.alts(...Object.keys(groupAssertionTypeMap).map(P.exact)).map((_, ctx) => ({
              type: 'GroupAssertionBehavior' as const,
              range: ctx.range
            }))
          ).opt()
        )
        .map(a => (a[1] ? [a[0], a[1]] : a[0])),

      this.Quantifier.trys()
    )
      .repeat()
      .map(v => {
        let a: Lexeme[] = [];
        for (let x of v) {
          if (Array.isArray(x)) {
            a.push(...x);
          } else {
            a.push(x);
          }
        }
        return a;
      });
  }
}

export const grammar = Grammar.def(new JSREGrammar());
export const lexer = grammar.rules.Lexer;

/**
@param re RegExp source
@param flags
@param partial Whether return error on not stop at the end of string
*/
export function parse(re: string | RegExp, flags?: AST.RegexFlags, partial = false): RegexParseResult {
  if (re instanceof RegExp) {
    flags = flags || AST.RegexFlags.parse(re.flags);
    re = re.source;
  }

  if (!flags) {
    flags = new AST.RegexFlags();
  }

  let state: RegexParseState = {
    flags,
    openPairs: [],
    features: {legacy: {}}
  };

  let result = grammar.parseWithState(re, state);
  if (!K.isResultOK(result)) {
    let u = result.error.userError;
    let p = result.error.position;
    return {error: u ? u : {type: 'SyntaxError', range: [p, p]}};
  } else {
    if (!partial && result.consumed !== re.length) {
      return {error: {type: 'SyntaxError', range: [result.consumed, result.consumed]}};
    }
    let regex = {expr: result.value, source: re.slice(0, result.consumed), flags};
    let error = check(regex.expr);
    if (error) {
      return {error};
    }

    return {value: regex};
  }
}

export function lex(re: string, flags: AST.RegexFlags): Lexeme[] {
  let state: RegexParseState = {
    flags,
    openPairs: [],
    loose: true,
    features: {
      legacy: {
        octalEscape: true,
        identityEscape: true,
        charClassEscapeInCharRange: true
      }
    }
  };

  let result = lexer.parse(re, state);
  if (K.isResultOK(result)) {
    return result.value;
  } else {
    return [];
  }
}
