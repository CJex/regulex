if (typeof define !== 'function') var define = require('amdefine')(module);
define(['../src/Kit','../src/RegExp','./testData','assert'],function (K,MyRegExp,testData,assert) {
var reMatchCases=testData.reMatchCases;


reMatchCases.forEach(function (c) {
  var re=c[0],strings=typeof c[1]==='string'?[c[1]]:c[1];
  var myRe=new MyRegExp(re.source,re);
  strings.forEach(function (s) {
    var result=re.exec(s),myResult=myRe.exec(s);
    try {
      assert.deepEqual(myResult,result,re);
    } catch(e) {
      re.debug=true;
      myRe=new MyRegExp(re.source,re);
      myResult=myRe.exec(s);
      K.log(re,myResult,result);
      throw e;
    }
  });

});

console.log('RegExp Test OK');

});

