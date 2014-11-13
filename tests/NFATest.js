if (typeof define !== 'function') var define = require('amdefine')(module);
define(['../src/Kit','../src/NFA','assert'],function (K,NFA,assert) {

testNFA();

console.log('NFA Test OK');
function testNFA() {
  var a=NFA({
    compact:true,accepts:'start',
    trans:[
      ['start>start','0369'],['start>q1','147'],['start>q2','258'],
      ['q1>q1','0369'],['q1>q2','147'],['q1>start','258'],
      ['q2>q2','0369'],['q2>q1','258'],['q2>start','147'],
    ]
  });
  var result,i,n;
  ['','0','00','000','012','03','3','6','9','12'].forEach(function (n) {
    assert.ok(a.input(n).acceptable);
  });

  i=500;nums=[];
  while (i--) {
    n=Math.ceil(Math.random()*1E15)*3 ;
    n=K.repeats(n+"",10);
    assert.ok(a.input(n).acceptable,n);
    assert.ifError(a.input(n+1).acceptable);
    assert.ifError(a.input(n+2).acceptable);
  }

}




});
