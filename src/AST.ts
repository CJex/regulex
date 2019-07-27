import {TokenRange} from './Parsec';
import * as K from './Kit';
import * as UT from 'utility-types';

export interface NodeBase {
  type: string;
  range: TokenRange;
}

export interface CharNode extends NodeBase {
  type: 'Char';
  value: string;
}

export interface DotNode extends NodeBase {
  type: 'Dot';
}

export interface BackrefNode extends NodeBase {
  // Backreference
  type: 'Backref';
  //  \3 or \k<name>
  index: number | string;
}

export type UnicodeCharClass = {name: string; invert: boolean; value?: string};
export const baseCharClassTuple = ['Digit', 'NonDigit', 'Word', 'NonWord', 'Space', 'NonSpace'] as const;
export type BaseCharClass = typeof baseCharClassTuple[number];

export interface CharClassEscapeNode extends NodeBase {
  type: 'CharClassEscape';
  charClass: UnicodeCharClass | BaseCharClass;
}

export interface CharRangeNode extends NodeBase {
  type: 'CharRange';
  begin: CharNode;
  end: CharNode;
}

export type CharClassItem = CharRangeNode | CharNode | CharClassEscapeNode;

export interface CharClassNode extends NodeBase {
  type: 'CharClass';
  invert: boolean;
  body: CharClassItem[];
}

export interface ListNode extends NodeBase {
  type: 'List';
  // Exclude<Expr,ListNode | DisjunctionNode> caused weird type error
  body: Array<Exclude<Exclude<Expr, ListNode>, DisjunctionNode>>;
}

export interface QuantifierNode extends NodeBase {
  type: 'Quantifier';
  min: number;
  max: number;
  greedy: boolean;
}

export interface RepeatNode extends NodeBase {
  type: 'Repeat';
  quantifier: QuantifierNode;
  body: AtomNode;
}

export interface DisjunctionNode extends NodeBase {
  type: 'Disjunction';
  body: Array<Exclude<Expr, DisjunctionNode>>;
}

export type GroupBehavior =
  // Group name could be unicode escape sequence, so we use rawName to track source
  | {type: 'Capturing'; index: number; named?: {name: string; rawName?: string}}
  | {type: 'NonCapturing'}
  | {type: 'Atomic'}
  | {type: 'EnableDup'};

export interface GroupNode extends NodeBase {
  type: 'Group';
  behavior: GroupBehavior;
  body: Expr;
}

export interface GroupAssertionNode extends NodeBase {
  type: 'GroupAssertion';
  look: 'Lookahead' | 'Lookbehind';
  negative: boolean;
  body: Expr;
}

export const baseAssertionTypeTuple = ['WordBoundary', 'NonWordBoundary', 'Begin', 'End'] as const;
export type BaseAssertionType = typeof baseAssertionTypeTuple[number];
export interface BaseAssertionNode extends NodeBase {
  type: 'BaseAssertion';
  kind: BaseAssertionType;
}

export type AssertionNode = BaseAssertionNode | GroupAssertionNode;

export type AtomNode = DotNode | CharClassNode | CharClassEscapeNode | CharNode | BackrefNode | GroupNode;

export type LeafNode = CharNode | DotNode | CharClassEscapeNode | BackrefNode | BaseAssertionNode | QuantifierNode;

export type BranchNode =
  | GroupAssertionNode
  | GroupNode
  | CharRangeNode
  | CharClassNode
  | RepeatNode
  | ListNode
  | DisjunctionNode;

/** Union of all RegExp syntax nodes */
export type Node = LeafNode | BranchNode;

/** Only top expr node types */
export type Expr = Exclude<Node, CharRangeNode | QuantifierNode>;

export class RegexFlags {
  public unicode = false;
  public dotAll = false;
  public global = false;
  public ignoreCase = false;
  public multiline = false;
  public sticky = false;
  public extended = false;

  static parse(flags: string): RegexFlags;
  static parse(flags: string, strict: true): K.Result<RegexFlags, string>;
  static parse(flags: string, strict: boolean = false): RegexFlags | K.Result<RegexFlags, string> {
    let reFlag = new RegexFlags();
    let invalid = [];
    for (let c of flags) {
      let p = RegexFlags.flagMap.get(c);
      if (p) {
        reFlag[p] = true;
      } else {
        invalid.push(c);
      }
    }
    if (strict) {
      if (invalid.length) {
        return {error: K.sortUnique(invalid).join('')};
      } else {
        return {value: reFlag};
      }
    }
    return reFlag;
  }

  static create(props?: {[K in UT.NonFunctionKeys<RegexFlags>]?: boolean}): RegexFlags {
    let a = new RegexFlags();
    if (props) {
      Object.assign(a, props);
    }
    return a;
  }

  toString() {
    let map = RegexFlags.invFlagMap;
    let keys = Array.from(map.keys()).sort();
    let flags = '';
    for (let k of keys) {
      if (this[k]) {
        flags += map.get(k);
      }
    }
    return flags;
  }

  static flagMap = new Map<string, UT.NonFunctionKeys<RegexFlags>>([
    ['u', 'unicode'],
    ['g', 'global'],
    ['i', 'ignoreCase'],
    ['s', 'dotAll'],
    ['m', 'multiline'],
    ['y', 'sticky'],
    ['x', 'extended']
  ]);

  static invFlagMap = K.invertMap(RegexFlags.flagMap);
}

export interface Regex {
  expr: Expr;
  flags: RegexFlags;
  source: string;
}
