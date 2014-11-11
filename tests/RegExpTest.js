if (typeof define !== 'function') var define = require('amdefine')(module);
define(['../src/Kit','../src/RegExp','./testData','assert'],function (K,MyRegExp,testData,assert) {
var reMatchCases=testData.reMatchCases;


reMatchCases.forEach(function (c) {
  var re=c[0],strings=typeof c[1]==='string'?[c[1]]:c[1];
  strings.forEach(function (s) {
    try {
      var myRe=new MyRegExp(re.source,re);
      var result=re.exec(s),myResult=myRe.exec(s);
      assert.deepEqual(myResult,result,re);
    } catch(e) {
      K.log(re);
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

