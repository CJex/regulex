import * as K from '../../src/Kit';
import * as FC from 'fast-check';
import {IndexSig} from '../../src/Kit';
import {produce} from 'immer';
import * as AST from '../../src/AST';
import * as JSRE from '../../src/grammar/JSRE';
import {BaseGen, runGrammarTest, GenState, TestCase, UtilGen, makeGenState, GenFn} from './BaseGen';

import {assert} from 'chai';
import {AssertionError} from 'assert';

export class JSREGen extends BaseGen {
  GroupBehavior(state: GenState): FC.Arbitrary<TestCase<AST.GroupBehavior>> {
    let {flags} = this;

    // shrink to BaseGroupName via constantFrom
    let BaseGroupName = FC.array(UtilGen.AlphaChar, 1, 20).map(a => a.map(t => t.expect).join(''));
    let ID = flags.unicode ? UtilGen.ID : UtilGen.ID16Bit;
    let GroupName = FC.tuple(
      BaseGroupName,
      FC.tuple(ID.Start, FC.array(ID.Continue)).map(([s1, sa]) => s1 + sa.join(''))
    )
      .chain(a => FC.constantFrom(...a))
      .filter(s => !state.groups.names.includes(s));

    return FC.oneof(
      FC.constantFrom<TestCase<AST.GroupBehavior>>(
        {source: '?:', expect: {type: 'NonCapturing'}, state: produce(state, st => void (st.pos += 2))},
        {source: '', expect: {type: 'Capturing', index: state.groups.count + 1}, state}
      ),
      GroupName.map(name => ({
        source: '?<' + name + '>',
        state: produce(state, st => void (st.pos += name.length + 3)),
        expect: {type: 'Capturing', index: state.groups.count + 1, name}
      }))
    );
  }
}

describe('Grammar.JSRE', function() {
  this.timeout(1000000);
  let testTypes = [
    'Char',
    'CharClassEscape',
    'Dot',
    'CharClass',
    'List',
    'Group',
    'BaseAssertion',
    'GroupAssertion',
    'Disjunction',
    'Repeat'
  ] as const;

  let flags = AST.RegexFlags.parse('u');
  let initState = makeGenState();
  let baseGen = new JSREGen(flags);

  for (let ty of testTypes) {
    let gen = (baseGen[ty] as GenFn<AST.NodeOfType<typeof ty>>)(initState);
    runGrammarTest(ty, JSRE.parse, gen.map(testCase => ({flags, testCase})));
  }
});
