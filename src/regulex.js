define(['./Kit','./NFA','./RegExp','./parse','./visualize','./libs/raphael'],
function (Kit,NFA,RegExp,parse,visualize,Raphael) {
  return { // I hate require.js
    Kit:Kit,
    NFA:NFA,
    RegExp:RegExp,
    parse:parse,
    Raphael:Raphael,
    visualize:visualize
  };
});
