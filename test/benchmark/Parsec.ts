import * as PM from '../../src/Parsec';
import * as K from '../../src/Kit';
import {Parser} from 'acorn';
import {Suite} from 'benchmark';

const P = PM.refine<string, null, null>();

const suite = new Suite();

type Node = {type: string; range: PM.TokenRange; body: string | number | Node | {left: Node; right: Node}};

function toNode(type: string): (v: Node['body'], info: {range: PM.TokenRange}) => Node {
  return (v, info): Node => ({type: type, range: info.range, body: v});
}

let toBinExprNode = toNode('BinaryExpr');
function toBinExpr([a, op, b]: [Node, Node, Node], info: {range: PM.TokenRange}): Node {
  return toBinExprNode({left: a, right: b}, info);
}

class BaseDef {
  Op = P.oneOf('+-').map(toNode('BinaryOperator'));
  Num = P.re(/\d+(?:\.\d+)?/)
    .slice()
    .map(toNode('Number'));
}

class ArithDef extends BaseDef {
  [rule: string]: PM.ParserDef<string, any, null, null>;
  Main() {
    return this.Expr();
  }

  Factor() {
    return P.spaced(
      P.alts(
        this.Expr()
          .betweens('(', ')')
          .map(toNode('Paren')),
        this.Num
      )
    );
  }
  Expr(): PM.Parser<string, Node, null, null> {
    return P.alts(P.seqs(this.Expr(), this.Op, this.Factor()).map(toBinExpr), this.Factor());
  }
}

const Arith = PM.Grammar.def(new ArithDef());

function genExpr(depth: number): string {
  if (!depth) return '0';
  return '3.2 + 454 -(2353 + 34 - (2+ (  ' + genExpr(depth - 1) + ' - (0.3+45 )) - 44.345))';
}

const expr = genExpr(180);

/*
let a = Arith.parse(expr);
console.dir(a,{depth:10});

if (!P.isResultOK(a)) {
  console.log(expr.slice(a.error.position-10,a.error.position+10));
}
process.exit();
*/

suite
  .add('Parsec', () => {
    Arith.parse(expr);
  })
  .add('Arcorn', () => {
    Parser.parse(expr);
  })
  .on('cycle', function(event: any) {
    console.log(String(event.target));
  })
  .on('complete', function(this: any) {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run();
