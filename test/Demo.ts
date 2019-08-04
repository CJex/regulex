import * as K from '../src/Kit';
import * as FC from 'fast-check';
import {IndexSig} from '../src/Kit';
import {testProp, genInCharset, property, prettyPrint} from './utils';
import {produce} from 'immer';
import * as AST from '../src/AST';
import * as JSRE from '../src/grammar/JSRE';
import * as _ from 'lodash';

import {assert, expect} from 'chai';

import {JSREGen} from './grammar/JSRESpec';

console.log(JSREGen);
