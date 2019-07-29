import * as K from '../src/Kit';
import * as C from 'fast-check';
import {testProp, sampleInCharRange} from './utils';
import {assert} from 'chai';
import Unicode from '../src/Unicode';
import * as UnicodeProperty from '../src/UnicodeProperty';
import {factorize, DEFAULT_UNICODE_PKG} from '../src/tools/buildUnicode';

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

  describe('Charset', function() {
    this.timeout(60000);

    testProp('fromPattern toPattern equal', listOfCharRange(), a => {
      let charset = new K.Charset(a);
      assert(K.Charset.fromPattern(charset.toPattern()).equals(charset));
    });

    testProp('should include/exclude chars', C.tuple(listOfCharRange(10), C.boolean()), ([a, toExclude]) => {
      let charset = new K.Charset(a);
      if (toExclude) {
        charset = K.Charset.fromPattern('^' + charset.toPattern());
      }
      for (let range of a) {
        for (let c of sampleInCharRange(range)) {
          assert(charset.includeChar(c) !== toExclude);
        }
      }
    });

    testProp('union intersect subtract', C.tuple(listOfCharRange(), listOfCharRange()), ([ranges1, ranges2]) => {
      let charset1 = new K.Charset(ranges1);
      let charset2 = new K.Charset(ranges2);
      assert(charset1.union(charset1).equals(charset1));
      let union = charset1.union(charset2);
      assert(charset1.isSubsetof(union));
      assert(charset2.isSubsetof(union));

      let inter = charset1.intersect(charset1);
      assert(inter && inter.equals(charset1));

      inter = charset1.intersect(charset2);
      if (inter.isEmpty()) {
        assert(union.subtract(charset1).equals(charset2));
        assert(union.subtract(charset2).equals(charset1));
      } else {
        assert(
          union
            .subtract(charset1)
            .union(inter)
            .equals(charset2)
        );
        assert(
          union
            .subtract(charset2)
            .union(inter)
            .equals(charset1)
        );
      }
    });

    testProp('inverted complementary', listOfCharRange(), a => {
      let include = new K.Charset(a);
      let exclude = K.Charset.fromPattern('^' + include.toPattern());

      assert(include.inverted().toPattern() === exclude.toPattern());

      assert.deepEqual(include.inverted().ranges, exclude.ranges);

      assert(include.inverted().equals(exclude));
      assert(exclude.inverted().equals(include));

      let charset1 = include.union(exclude);
      assert(charset1.equals(K.Charset.unicode));

      let charset2 = K.Charset.unicode.subtract(exclude);
      assert(charset2.equals(include));

      assert(include.intersect(exclude).isEmpty());
    });

    // Impractical, took several seconds or even minutes to complete these tests
    if (false) {
      let unicodeCats = (function() {
        let a: string[] = [];
        let U = Object.assign({}, UnicodeProperty.canonical) as {[k: string]: Set<string>};
        delete U.NonBinary_Property;
        for (let k in U) {
          for (let cat of U[k]) {
            a.push(k + '/' + cat);
          }
        }
        return a;
      })();

      const genUnicodeCat = C.constantFrom(...unicodeCats);

      it('Unicode module', () => {
        for (let path of unicodeCats) {
          let codePoints = require(DEFAULT_UNICODE_PKG + '/' + path + '/code-points.js');
          let charset = K.Charset.fromCodePoints(codePoints);
          let [cls, cat] = path.split('/');
          assert(charset.equals((Unicode as any)[cls][cat]));
        }
      });

      testProp('Unicode category fromPattern toPattern equal', genUnicodeCat, cat => {
        let codePoints = require(DEFAULT_UNICODE_PKG + '/' + cat + '/code-points.js');
        let charset = K.Charset.fromCodePoints(codePoints);
        assert(K.Charset.fromPattern(charset.toPattern()).equals(charset));
      });

      testProp('fromCodePoints toCodePoints equal', genUnicodeCat, cat => {
        let codePoints = require(DEFAULT_UNICODE_PKG + '/' + cat + '/code-points.js');
        let charset = K.Charset.fromCodePoints(codePoints);
        assert.deepEqual(charset.toCodePoints(), codePoints);
      });

      testProp('factorize', C.array(listOfCharRange(), 1, 60), a => {
        let charsets = a.map(ranges => new K.Charset(ranges));
        let {factors, mapping} = factorize(charsets);
        if (factors.length) {
          assertNonOverlap(factors);
        } else {
          for (let c of charsets) {
            assert(!mapping.has(c));
          }
        }

        let factorUnion = K.Charset.union(factors);
        let union = K.Charset.union(charsets);

        assert(factorUnion.equals(union));

        let factorSize = K.sum(factors.map(c => c.getSize()));
        let factorUnionSize = factorUnion.getSize();
        let unionSize = union.getSize();
        assert(factorSize === unionSize && factorUnionSize === unionSize);

        for (let [c, parts] of mapping) {
          let u = K.Charset.union(parts);
          assertNonOverlap(parts);
          assert(c.equals(u));
        }

        for (let c of charsets) {
          if (!mapping.has(c)) {
            for (let a of factors) {
              assert(a === c || c.intersect(a).isEmpty());
            }
          }
        }

        function assertNonOverlap(a: K.Charset[]): void {
          a.reduce((prev, current) => {
            assert(prev.intersect(current).isEmpty());
            return current;
          });
        }
      });
    }
  });
});
