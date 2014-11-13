if (typeof define !== 'function') var define = require('amdefine')(module);
define(['../src/parse','../src/Kit','./testData','assert'],function (parse,K,testData,assert) {
var expectedPass=testData.expectedPass;
var expectedFail=testData.expectedFail;
var re2ast=testData.re2ast;

parse.getNFAParser().assertDFA();

testSyntax();
testAST();
console.log('Parse Test OK');

function testAST() {
  re2ast.forEach(function  (ast) {
    try {
      assert.deepEqual(parse(ast.raw),ast);
    } catch(e) {
      if (e instanceof assert.AssertionError) {
        K.log(parse(ast.raw));
        K.log(ast);
      }
      throw e;
    }
  })
  return;
}

function testSyntax() {
  expectedPass.forEach(function (v) {
    var ast;
    try {
      ast=parse(v);
    } catch(e) {
      if (e instanceof parse.RegexSyntaxError) {
        console.log(e.message);
        console.log(v);
        console.log(K.repeats(" ",e.lastIndex)+"^");
        K.log(e);
        parse(v,true);
      } else {
        K.log(v);
        parse(v,true);
      }
      throw e;
    }
  });

  expectedFail.forEach(function (v) {
    var ast;
    try {
      ast=parse(v);
      console.error("Expected to fail but passed!");
      K.log(v);
      ast=parse(v,true);
      K.log(ast);
    } catch (e) {
      if (e instanceof parse.RegexSyntaxError) {
        return true;
      }
      throw e;
    }
  });
}





});

