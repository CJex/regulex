if (typeof define !== 'function') var define = require('amdefine')(module);
define(['../src/Kit','assert'],function (K,assert) {

testCoalesce();
testIdUnique();
testKSet();
testClassify();
testParseCharset();
testHashUnique();

console.log('Kit Test OK');

function testCoalesce() {
  var ranges,results;

  ranges=K.classify(['az','AZ','09']).ranges;
  results=K.coalesce(ranges);
  assert.deepEqual(results,ranges);

  ranges=K.classify(['az','ez','z','a']).ranges;
  results=K.coalesce(ranges);
  assert.deepEqual(results,['az']);

  ranges=K.classify(['Aa','AZ','az']).ranges;
  results=K.coalesce(ranges);
  assert.deepEqual(results,['Az']);

  ranges=K.classify(K.negate(['Aa','az'])).ranges;
  results=K.coalesce(ranges);
  assert.deepEqual(results,K.negate(['Az']));

  ranges=K.classify(['ab','cd','xy']).ranges;
  results=K.coalesce(ranges);
  assert.deepEqual(results,['ad','x','y']);
}

function testIdUnique() {
  var a=[console,testIdUnique,testKSet,testClassify,testParseCharset,this];
  var b=K.idUnique(a.concat(a));
  assert.ok(b.length===a.length);
}

function testHashUnique() {
  var a=[],i=100,min=K.ord('A'),max=K.ord('Z'),c,hash={};
  while (i--) {
    c=K.chr(Math.random()*(max-min)+min);
    a.push(c);
    hash[c]=1;
  }
  var expected=Object.keys(hash);//what? really?
  assert.deepEqual(K.hashUnique(a),expected);
}

function testKSet() {
  var n=200;
  for (var i=0;i<n;i++) {
    var size=i*2,a=new Array(size);
    for (var j=0;j<size;j+=2) {
      a[j]=Math.random()*n|0;a[j+1]=a[j];
    }
    a.push(1);
    var s=K.Set(a.slice()),s2=s.union(s),
        sa=s.toArray();
    assert.ok(s.length<=((a.length)/2+1));
    a.forEach(function (x) {
      assert.ok(s.contains(x));
      assert.ifError(s.contains(x+0.5));
      assert.ok(s.indexOf(x)===sa.indexOf(x));
      assert.ok(s.indexOf(x+0.5)===sa.indexOf(x+0.5));
    });
    assert.deepEqual(s.toArray(),s2.toArray());
  }
}

function testClassify() {
  var classify=K.classify;
  var negate=K.negate;
  var a,ret;

  a=['a'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,a);

  a=['a','b'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,a);

  a=['a','b','c'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,a);

  a=['ac','df'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,a);

  a=['ab','bz'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['a','b','cz']);

  a=['a','ac','cz'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['a','b','c','dz']);
  assert.deepEqual(ret.map,{
    'a':['a'],'ac':['a','b','c'],
    'cz':['c','dz']
  });

  a=['ab','az'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['ab','cz']);

  a=['a','b','c','cz'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['a','b','c','dz']);

  a=['az','b','c','cz'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['a','b','c','dz']);
  assert.deepEqual(ret.map,{
    az:['a','b','c','dz'],b:['b'],c:['c'],
    cz:['c','dz']
  });

  a=['af','bz','df','cz'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['a','b','c','df','gz']);

  a=['ah','eq','qz'];
  ret=classify(a);
  assert.deepEqual(ret.map,{
    ah: [ 'ad', 'eh' ],
    eq: [ 'eh', 'ip', 'q' ],
    qz: [ 'q', 'rz' ]
  });
  assert.deepEqual(ret.ranges,['ad','eh','ip','q','rz']);

  a=['ch','az'];
  ret=classify(a);
  assert.deepEqual(ret.ranges,['ab','ch','iz']);

  a="(){}[]\\#\"'; \n\t\r\f".split("").concat("\0\uFFFF");
  ret=classify(a);
  assert.equal(ret.map["\0\uFFFF"].length,ret.ranges.length);


  a=negate(['by','28']);
  assert.deepEqual(a,["\u00001","9a","z\uffff"])
  ret=classify(a);
  assert.deepEqual(ret.ranges,a);

  a=negate(["\u0000a","z\uffff"]);
  assert.deepEqual(a,["by"]);

  assert.deepEqual(negate(["\u0000\uffff"]),[]);

  a=negate(['cx','by']);
  assert.deepEqual(a,["\u0000a","z\uffff"]);


}

function testParseCharset() {
  var c,ranges,expected,parseCharset=K.parseCharset;

  c="a-z0-9";
  ranges=parseCharset(c);
  expected=['09','az'];
  assert.deepEqual(ranges,expected);

  c="^b-y2-8";
  ranges=parseCharset(c);
  expected=["\u00001","9a","z\uffff"];
  assert.deepEqual(ranges,expected);

  c="^b-yh-i";
  ranges=parseCharset(c);
  expected=["\u0000a","z\uffff"];
  assert.deepEqual(ranges,expected);

  c="a-z0-9_$^-";
  ranges=parseCharset(c);
  expected=["az","09","_","$","-","^"].sort();
  assert.deepEqual(ranges,expected);

  c="^-b";
  ranges=parseCharset(c);
  expected=["\u0000"+K.pred("-"),K.succ("-")+"a","c\uffff"];
  assert.deepEqual(ranges,expected);

  c='^+*?^$.|(){[\\';

  ranges=parseCharset(c);
  expected=[ '\u0000#','%\'',',-','/>','@Z',']','_z','}\uffff' ];
  assert.deepEqual(ranges,expected);

  c='^acdf';
  ranges=parseCharset(c);
  expected=[ '\u0000`', 'b','e', 'g\uffff' ];
  assert.deepEqual(ranges,expected);
}







});
