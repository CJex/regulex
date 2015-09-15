if (typeof define !== 'function') var define = require('amdefine')(module);
define(['./src/Kit','./src/NFA','./src/RegExp','./src/parse'],
function (Kit,NFA,RegExp,parse) {
  return { // NPM,Bower,Require.js.....Doom!
    Kit:Kit,
    NFA:NFA,
    RegExp:RegExp,
    parse:parse
  };
});
