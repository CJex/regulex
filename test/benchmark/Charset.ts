import {Charset, Char, randInt} from '../../src/Kit';
import * as K from '../../src/Kit';
import Unicode from '../../src/Unicode';
import {Suite} from 'benchmark';
import assert = require('assert');

const suite = new Suite();

let charset = Unicode.General_Category.Letter;
let regex = new RegExp('^' + Unicode.General_Category.Letter.toRegex().source + '+$', 'u');

let chars = charset
  .toCodePoints(2000)
  .map(Char.chr)
  .sort(() => {
    if (Math.random() > 0.5) return K.Ordering.GT;
    return K.Ordering.LT;
  });
let str = chars.join('');

function randChar(): string {
  return chars[randInt(0, chars.length - 1)];
}

suite
  .add('Charset', () => {
    for (let c of chars) {
      charset.includeChar(c);
    }
  })
  .add('Regex', () => {
    assert(regex.test(str));
  })
  .on('cycle', function(event: any) {
    console.log(String(event.target));
  })
  .on('complete', function(this: any) {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run();
