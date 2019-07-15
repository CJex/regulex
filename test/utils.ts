import * as C from 'fast-check';
import * as K from '../src/Kit';
import {AssertionError} from 'power-assert';

// import _assert = require('power-assert');
// export const assert = _assert.customize({output: {maxDepth: 5}});

export function prettyPrint(a: any, indent = 2): string {
  let mem: any = {};
  let code = JSON.stringify(replace('', a), replace, indent);
  let keys = Object.keys(mem);
  if (keys.length) {
    code = code.replace(new RegExp(keys.map(k => '"' + k + '"').join('|'), 'g'), k => {
      return mem[k.slice(1, -1)];
    });
  }
  return code;

  function replace(k: string, v: any) {
    if (v instanceof RegExp || v == null || isNumber(v)) {
      let guid = K.guid();
      mem[guid] = v;
      return guid;
    } else if (v[K._inspect_]) {
      return v[K._inspect_]();
    } else if (v instanceof Set || v instanceof Map) {
      return Array.from(v);
    } else if (!Array.isArray(v) && Object.prototype.toString.call(v) === '[object Object]') {
      return sortKeys(v);
    } else {
      return v;
    }
  }

  function sortKeys(a: any) {
    let keys = Object.keys(a).sort();
    let b = Object.create(null);
    for (let k of keys) {
      b[k] = a[k];
    }
    return b;
  }
}

/**
Use cli env to specify seed and path to replay test
  export seedpath='{ seed: 1540961949765, path: "18:1:0" }'
  npm run testit src/DemoSpec.js
*/
export function testProp<T>(desc: string, arb: C.Arbitrary<T>, f: (t: T) => boolean | void) {
  return it(desc, property(arb, f));
}

export function property<T>(arb: C.Arbitrary<T>, f: (t: T) => boolean | void) {
  let g = (t: T) => {
    try {
      return f(t);
    } catch (e) {
      if (e.code === 'ERR_ASSERTION') {
        // See: https://github.com/dubzzz/fast-check/blob/5bde555628eff5284eaf78c8056afbdb796c312d/src/check/property/Property.generic.ts#L32
        // Property.run turns any error with stack trace into string
        // But we dont need stack trace for AssertionError.
        delete e.stack;
        throw e;
      } else {
        throw e;
      }
    }
  };

  return () => {
    let params: any = {};
    if (process.env.seedpath) {
      params = JSON.parse(process.env.seedpath.replace(/seed|path/g, '"$&"'));
      params.endOnFailure = true;
    }
    let prop = C.property(arb, g);
    const out = C.check(prop, params);
    if (out instanceof Promise) {
      return out.then(_throwIfFailed);
    } else {
      _throwIfFailed(out);
    }
  };
}

function _throwIfFailed<T>(out: C.RunDetails<T>) {
  if (out.failed) {
    let e;
    if (out.counterexample == null) {
      e = new AssertionError({
        message: `Failed to run property, too many pre-condition failures encountered\n\nRan ${out.numRuns} time(s)\nSkipped ${out.numSkips} time(s)\n\nHint (1): Try to reduce the number of rejected values by combining map, flatMap and built-in arbitraries\nHint (2): Increase failure tolerance by setting maxSkipsPerRun to an higher value`
      });
    } else {
      e = new AssertionError({
        message: `Property failed after ${out.numRuns} tests\n{ seed: ${out.seed}, path: "${
          out.counterexamplePath
        }" }\nCounterexample: ${prettyPrint(out.counterexample)}\nShrunk ${out.numShrinks} time(s)\nGot error: \n${
          out.error
        }\n\n${
          out.failures.length === 0
            ? 'Hint: Enable verbose mode in order to have the list of all failing values encountered during the run'
            : `Encountered failures were:\n- ${out.failures.map(a => prettyPrint(a)).join('\n- ')}`
        }`,
        expected: out.counterexample
      });
    }

    throw e;
  }
}

export function allEqual(a: any[]): boolean {
  for (let i = 1; i < a.length; i++) {
    if (a[i] !== a[0]) return false;
  }
  return true;
}

function isNumber(n: any) {
  return Object.prototype.toString.call(n) === '[object Number]';
}
