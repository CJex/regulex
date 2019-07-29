import {TokenRange} from './Parsec';
import {SubstIn} from './Kit';
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

export function isBaseCharClass(node: Node): node is CharClassEscapeNode;
export function isBaseCharClass(node: NodeF<any>): node is CharClassEscapeNode;
export function isBaseCharClass(node: NodeF<any>): node is CharClassEscapeNode {
  return node.type === 'CharClassEscape' && typeof node.charClass === 'string';
}

export function isAssertion(node: Node): node is AssertionNode;
export function isAssertion<X>(node: NodeF<X>): node is SubstIn<AssertionNode, Node, X>;
export function isAssertion<X>(node: NodeF<X>): node is SubstIn<AssertionNode, Node, X> {
  return node.type === 'BaseAssertion' || node.type === 'GroupAssertion';
}

export function isEmptyNode(node: Node): node is ListNode;
export function isEmptyNode<X = any>(node: NodeF<X>): node is SubstIn<ListNode, Node, X>;
export function isEmptyNode<X = any>(node: NodeF<X>): node is SubstIn<ListNode, Node, X> {
  if (node.type === 'List') {
    return !node.body.length;
  } else {
    return false;
  }
}

export function makeEmptyNode(position?: number): ListNode;
export function makeEmptyNode<X = any>(position?: number): SubstIn<ListNode, Node, X>;
export function makeEmptyNode<X = any>(position = 0): SubstIn<ListNode, Node, X> {
  return {type: 'List', body: [], range: [position, position]};
}

const _BranchNodeTypeTuple = [
  'GroupAssertion',
  'Group',
  'Repeat',
  'List',
  'Disjunction',
  'CharClass',
  'CharRange'
] as const;

export const BranchNodeTypeTuple: BranchNode['type'] extends typeof _BranchNodeTypeTuple[number]
  ? typeof _BranchNodeTypeTuple
  : never = _BranchNodeTypeTuple; // The type is only used to assert the tuple included all BranchNode types.

export const BranchNodeTypeSet = new Set<BranchNode['type']>(BranchNodeTypeTuple);

export function isBranchNode(n: Node): n is BranchNode;
export function isBranchNode<X>(n: NodeF<X>): n is SubstIn<BranchNode, Node, X>;
export function isBranchNode<X>(n: NodeF<X>): n is SubstIn<BranchNode, Node, X> {
  return BranchNodeTypeSet.has(n.type as any);
}

export interface INode extends NodeBase {
  type: Node['type'];
}

export type PickByNodeType<N extends INode, T extends Node['type']> = N extends {type: T} ? N : never;
export type NodeOfType<T extends INode['type']> = PickByNodeType<Node, T>;

type VisitorFn<N extends INode, K extends N['type']> = (cur: PickByNodeType<N, K>, parent?: N) => void;
type VisitorCase<N extends INode, K extends N['type']> =
  | VisitorFn<N, K>
  | {
      enter: VisitorFn<N, K>;
      leave: VisitorFn<N, K>;
    };

/**
Simple stateful visitor function executed top down or custom enter leave
*/
export type FullVisitor<N extends INode = Node> = {[K in N['type']]: VisitorCase<N, K>};

export type Visitor<N extends INode = Node> =
  | FullVisitor<N>
  | (UT.DeepPartial<FullVisitor<N>> & {defaults: VisitorCase<N, N['type']>});

export type FullMatchClause<A, B, N extends INode = Node> = {
  [K in N['type']]: ((node: A extends N ? PickByNodeType<N, K> : SubstIn<PickByNodeType<N, K>, N, A>) => B);
};

export type MatchClause<A, B, N extends INode = Node> =
  | FullMatchClause<A, B, N>
  | (Partial<FullMatchClause<A, B, N>> & {defaults: (node: A extends N ? N : SubstIn<N, N, A>) => B});

export type NodeF<X, N = Node> = SubstIn<N, N, X>;

/**
Shallow dispatch visitor function by Node's type.
*/
export function match<T>(node: Node, clause: MatchClause<Node, T>): T;
export function match<A, B>(node: NodeF<A>, clause: MatchClause<A, B>): B;
export function match<N extends INode, A, B>(node: N, clause: MatchClause<A, B, N>): B;
export function match<T>(node: Node, clause: MatchClause<Node, T, Node>): T {
  let v = clause as any;
  return (v[node.type] || v.defaults)(node as any);
}

export function fmap<T>(node: Node, f: (n: Node) => T): NodeF<T>;
export function fmap<A, B>(node: NodeF<A>, f: (n: A) => B): NodeF<B>;
export function fmap<A, B>(node: NodeF<A>, f: (n: A) => B): NodeF<B> {
  if (isBranchNode(node)) {
    if (node.type === 'CharRange') {
      let n: SubstIn<CharRangeNode, Node, B> = Object.create(node);
      n.begin = f(node.begin);
      n.end = f(node.end);
      return n;
    } else if (node.type === 'CharClass' || node.type === 'Disjunction' || node.type === 'List') {
      let n: SubstIn<CharClassNode | DisjunctionNode | ListNode, Node, B> = Object.create(node);
      n.body = node.body.map(f);
      return n;
    } else {
      let n: SubstIn<GroupAssertionNode | RepeatNode | GroupNode, Node, B> = Object.create(node);
      n.body = f(node.body);
      if (node.type === 'Repeat') {
        (n as any).quantifier = f(node.quantifier);
      }
      return n;
    }
  } else {
    return node;
  }
}

/**
Bottom up transform node, aka Catamorphism.
*/
export function bottomUp<T, N extends Node = Node>(n: N, f: (n: SubstIn<N, N, T>, parent?: N) => T): T;
export function bottomUp<T, N>(
  n: N,
  f: (n: SubstIn<N, N, T>, parent?: N) => T,
  _fmap: (n: N, fn: (a: N) => T) => SubstIn<N, N, T>
): T;
export function bottomUp<T, N>(
  n: N,
  f: (n: SubstIn<N, N, T>, parent?: N) => T,
  _fmap: (n: N, fn: (a: N) => T) => SubstIn<N, N, T> = fmap as any
): T {
  function cata(n: N, parent?: N): T {
    return f(_fmap(n, a => cata(a, n)), parent);
  }
  return cata(n);
}

/** Simple Node Tree stateful visit, default top down */
export function visit(node: Node, visitor: Visitor, parent?: Node): void;
export function visit<N extends Node>(node: N, visitor: Visitor<N>, parent?: N): void;
export function visit(node: Node, visitor: Visitor, parent?: Node): void {
  let vf: VisitorCase<Node, any> = visitor[node.type] || (visitor as any).defaults;
  if (typeof vf !== 'function') {
    if (vf.enter) {
      vf.enter(node, parent);
    }
    down();
    if (vf.leave) {
      vf.leave(node, parent);
    }
  } else {
    vf(node, parent);
    down();
  }

  function down() {
    if (isBranchNode(node)) {
      if (node.type === 'CharRange') {
        visit(node.begin, visitor, node);
        visit(node.end, visitor, node);
      } else if (node.type === 'CharClass' || node.type === 'Disjunction' || node.type === 'List') {
        node.body.forEach((n: Node) => visit(n, visitor, node));
      } else {
        visit(node.body, visitor, node);
        if (node.type === 'Repeat') {
          visit(node.quantifier, visitor, node);
        }
      }
    }
  }
}

export function indent(n: Node, indent: number): Node {
  visit(n, {
    defaults(node) {
      node.range[0] += indent;
      node.range[1] += indent;
    }
  });
  return n;
}

export interface RegexGroupsInfo {
  count: number;
  names: Set<string>;
}

export function getGroupsInfo(re: Node, _renumber: boolean): RegexGroupsInfo;
export function getGroupsInfo(re: NodeF<any>, _renumber: boolean): RegexGroupsInfo;
export function getGroupsInfo(re: Node, _renumber = false): RegexGroupsInfo {
  let groups = {count: 0, names: new Set<string>()};

  visit(re, {
    Group(n) {
      if (n.behavior.type === 'Capturing') {
        if (n.behavior.named) {
          groups.names.add(n.behavior.named.name);
        }
        groups.count++;
        if (_renumber) {
          n.behavior.index = groups.count;
        }
      }
    },
    defaults() {}
  });

  return groups;
}

export function renumberGroups(re: Node): RegexGroupsInfo;
export function renumberGroups(re: NodeF<any>): RegexGroupsInfo;
export function renumberGroups(re: Node): RegexGroupsInfo {
  return getGroupsInfo(re, true);
}
