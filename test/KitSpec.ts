import * as K from '../src/Kit';
import * as C from 'fast-check';
import {testProp} from './utils';

import assert = require('assert');

const charPairGen = () => C.tuple(C.fullUnicode(), C.fullUnicode());
const charRangeGen = () =>
  charPairGen().map(a => {
    a.sort(K.compareFullUnicode);
    return K.CharRange.fromCharPair(a[0], a[1]);
  });
const listOfCharRange = (max = 40) => C.array(charRangeGen(), 1, max);

describe('Kit', () => {
  describe('bsearch', () => {
    testProp('should be found', C.array(C.integer()), a => {
      a = a.sort(K.compare);
      for (let i = 0; i < a.length; i++) {
        let {found, index} = K.bsearch(a, a[i]);
        assert(found && a[index] === a[i]);
      }
    });

    testProp('should be not found but stop at right index', C.array(C.integer()), a => {
      if (!a.length) {
        var {found, index} = K.bsearch(a, 12345);
        assert(!found && index === -1);
        return;
      }

      a = a.sort(K.compare);
      var {found, index} = K.bsearch(a, a[0] - 1);
      assert(!found && index === -1);
      var {found, index} = K.bsearch(a, a[a.length - 1] + 1);
      assert(!found && index === a.length - 1);

      for (let i = 0; i < a.length - 1; i++) {
        if (a[i] === a[i + 1]) continue;
        // let x = generate a number not in array
        let x = (a[i] + a[i + 1]) / 2;
        // a[i] < x < a[i+1]
        // So it should not be found but stop at i
        var {found, index} = K.bsearch(a, x);
        assert(!found && index === i);
      }
    });
  });

  describe('sortUnique', () => {
    testProp('should return distinct', C.array(C.integer()), a => {
      let b = K.sortUnique(a);
      let n = new Set(a).size;
      assert(b.length === n);
      for (let i = 0; i < a.length; i++) {
        assert(K.bsearch(b, a[i]).found);
      }
    });
  });

  describe('CharRange', () => {
    it('compareFullUnicode', () => {
      // String.fromCodePoint(0x1F437) == "🐷" == "\uD83D\uDC37" == "\u{1F437}"
      let c1 = '\uD83D\uDC37';
      let c2 = '\uFA16';
      assert(K.compareFullUnicode(c1, c2) > 0);
    });

    testProp('subtract join intersect', C.tuple(charRangeGen(), charRangeGen()), a => {
      let [r1, r2] = a;
      assert(K.CharRange.subtract(r1, r1) === undefined);
      assert(K.CharRange.join(r1, r1) === r1);

      let inter = K.CharRange.intersect(r1, r2);
      if (inter === undefined) {
        assert(K.CharRange.subtract(r1, r2) === r1);
        assert(K.CharRange.subtract(r2, r1) === r2);
      } else {
        let join = K.CharRange.join(r1, r2);
        if (join === undefined) return assert(join !== undefined);

        let j1 = K.CharRange.subtract(join, r1);
        if (j1 === undefined) return assert(join === r1 && K.CharRange.isSubsetOf(r2, r1));
        let j2 = K.CharRange.subtract(join, r2);
        if (j2 === undefined) return assert(join === r2 && K.CharRange.isSubsetOf(r1, r2));

        if (Array.isArray(j1)) {
          assert(inter === r1);
        } else if (Array.isArray(j2)) {
          assert(inter === r2);
        } else {
          assert(K.CharRange.join(j1, inter) === r2);
          assert(K.CharRange.join(j2, inter) === r1);
        }
      }
    });

    testProp('should include after coalesce', listOfCharRange(), a => {
      let ranges = K.CharRange.coalesce(a);
      for (let r of a) {
        let {found, index} = K.bsearch(ranges, r, K.CharRange.compareIn);
        assert(found && K.CharRange.isSubsetOf(r, ranges[index]));
      }
    });
  });
});
