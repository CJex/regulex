import * as K from '../src/Kit';
import * as C from 'fast-check';
import {testProp} from './utils';

import assert = require('assert');

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
});
