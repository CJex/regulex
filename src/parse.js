if (typeof define !== 'function') var define = require('amdefine')(module);
define(['./NFA','./Kit'],function (NFA,K) {
/**
Parse Regex to AST
parse:Function(re:String)
parse.Constants
parse.exportConstants:Function
*/

var Constants={
  //Node Type Constants
  EXACT_NODE:"exact",
  CHARSET_NODE:"charset",
  CHOICE_NODE:"choice",
  GROUP_NODE:"group",
  ASSERT_NODE:"assert",
  DOT_NODE:"dot",
  BACKREF_NODE:"backref",
  EMPTY_NODE:"empty",
  //Assertion Type Constants
  AssertLookahead:"AssertLookahead",
  AssertNegativeLookahead:"AssertNegativeLookahead",
  AssertNonWordBoundary:"AssertNonWordBoundary",
  AssertWordBoundary:"AssertWordBoundary",
  AssertEnd:"AssertEnd",
  AssertBegin:"AssertBegin"
};

/**
AST:
  Node = { // Base Node interface
    type:NodeType,      // Node type string
    raw:String,         // Raw regex string
    repeat:{
      min:Int,max:Int,  // Repeat times. [min,max] means "{min,max}".
                        // Set max=Infinity forms a "{min,}" range
                        // Set max=undefined forms a "{min}" range
      nonGreedy:Boolean // If this repeat is non-greedy,viz. had a "?" quantifier
    },
    indices:[Int,Int]   // Raw string in original regex index range [start,end)
                        // You can use regexStr.slice(start,end) to retrieve node.raw string
  }

  NodeType = exact|dot|charset|choice|empty|group|assert|backref

  ExactNode = { // Literal match chars string
    type:"exact",
    chars:"c",
    raw:"c{1,2}"   // When repeat or escape,raw will diff from chars
  }
  DotNode = {type:"dot"} //viz. "." , dot match any char but newline "\n\r"

  // Because of IgnoreCase flag,
  // The client code need to compute disjoint ranges itself.
  CharsetNode = {
    type:"charset",
    exclude:Boolean,   // True only if it is "[^abc]" form
    classes:[Char],  // Named character classes. e.g. [\d].
                       // All names: d(Digit),D(Non-digit),w,W,s,S
    chars:String,      // Literal chars. e.g. [abc] repr as 'abc'
    ranges:[Range]     // Range: a-z repr as 'az'
  }

  ChoiceNode = {
    type:"choice",
    branches:[[Node]] // Choice more branches,e.g. /a|b|c/
  }

  EmptyNode = {  // This node will match any input,include empty string
    type:"empty" //new RegExp("") will give an empty node. /a|/ will give branches with an empty node
  }

  GroupNode = {
    type:"group",
    nonCapture:false, // true means:"(?:abc)",default is false
    num:Int, // If capture is true.It is group's int index(>=1).
    endParenIndex:Int, // /(a)+/ will generate only one node,so indices is [0,4],endParenIndex is 3
    sub:[Node]   // Sub pattern nodes
  }

  AssertNode = {
    type:"assert",
    assertionType:String, //See Assertion Type Constants
    sub:[Node]            //Optional,\b \B ^ $ Assertion this property is empty
  }
  Only AssertLookahead,AssertNegativeLookahead has `sub` property
  "(?=(abc))" repr as {
    type:"assert", assertionType:AssertLookahead,
    sub:[{
      type:"group",
      sub:[{type:"exact",raw:"abc"}]
    }]
  }

  BackrefNode = {
    type:"backref",
    num:Int     // Back references index.Correspond to group.num
  }

*/

function exportConstants() {
  var code=Object.keys(Constants).map(function (k) {
    return k+"="+JSON.stringify(Constants[k]);
  }).join(";");
  var Global=(function () {
    return this;
  })();
  Global.eval(code);
}
exportConstants();

function AST(a) {
  this.raw=a.raw;
  this.tree=a.tree;
  this.groupCount=a.groupCount;
}
/**
@param {Function} f   Visitor function accept node as one argument.
@param {String} nodeType Give the node type you want to visit,or omitted to visit all
*/
AST.prototype.traverse=function (f,nodeType) {
  travel(this.tree,f);
  function travel(stack,f) {
    stack.forEach(function (node) {
      if (!nodeType || node.type===nodeType) f(node);
      if (node.sub) travel(node.sub,f);
      else if (node.branches) node.branches.forEach(function (b) {travel(b,f)});
    });
  }
};


var G_DEBUG;
/**
@param {String}  re  input regex as string
@param {Object} [options]
  @option {Boolean} options.debug   If enable debug log
  @option {Boolean} options.strict  If enable strict mode
@return {Object}
{
  raw:String,     // original re
  groupCount:Int, //Total group count
  tree:Array      // AST Tree Stack
}
*/
function parse(re,_debug) {
  G_DEBUG=_debug;
  var parser=getNFAParser();

  var ret,stack,lastState;
  ret=parser.input(re,0,_debug);
  stack=ret.stack;
  stack=actions.endChoice(stack); // e.g. /a|b/
  lastState=ret.lastState;
  var valid=ret.acceptable && ret.lastIndex===re.length-1;//just syntax valid regex
  if (!valid) {
    var error;
    switch (lastState) {
      case 'charsetRangeEndWithNullChar':
        error={
          type:'CharsetRangeEndWithNullChar',
          message:"Charset range end with NUL char does not make sense!\n"+
                      "Because [a-\\0] is not a valid range.\n"+
                      "And [\\0-\\0] should be rewritten into [\\0].",
        };
        break;
      case 'repeatErrorFinal':
        error={
          type:'NothingRepeat',
          message:"Nothing to repeat!"
        };
        break;
      case 'digitFollowNullError':
        error={
          type:'DigitFollowNullError',
          message:"The '\\0' represents the <NUL> char and cannot be followed by a decimal digit!"
        };
        break;
      case 'charsetRangeEndClass':
        error={
          type:'CharsetRangeEndClass',
          message:'Charset range ends with class such as "\\w\\W\\d\\D\\s\\S" is invalid!'
        };
        break;
      case 'charsetOctEscape':
        error={
          type:'DecimalEscape',
          message:'Decimal escape appears in charset is invalid.Because it can\'t be explained as  backreference.And octal escape is deprecated!'
        };
        break;
      default:
        if (lastState.indexOf('charset')===0) {
          error={
            type:'UnclosedCharset',
            message:'Unterminated character class!'
          };
        } else if (re[ret.lastIndex]===')') {
          error={
            type:'UnmatchedParen',
            message:'Unmatched end parenthesis!'
          };
        } else {
          error={
            type:'UnexpectedChar',
            message:'Unexpected char!'
          }
          ret.lastIndex++;
        }
    }
    if (error) {
      error.lastIndex=ret.lastIndex;
      error.astStack=ret.stack;
      error.lastState=lastState;
      throw new RegexSyntaxError(error);
    }
  }

  if (stack._parentGroup) {
    throw new RegexSyntaxError({
      type:"UnterminatedGroup",
      message:"Unterminated group!",
      lastIndex:stack._parentGroup.indices[0],
      lastState:lastState,
      astStack:stack
    });
  }

  if (valid) {
    var groupCount=stack.groupCounter?stack.groupCounter.i:0;
    delete stack.groupCounter;
    var ast=new AST({
      raw:re,
      groupCount:groupCount,
      tree:stack
    });
    _fixNodes(stack,re,re.length);
    // Check charset ranges out of order error.(Because of charsetRangeEndEscape)
    ast.traverse(_checkCharsetRange,CHARSET_NODE);
    // Check any repeats after assertion. e.g. /a(?=b)+/ doesn't make sense.
    ast.traverse(_checkRepeat,ASSERT_NODE);
    _coalesceExactNode(stack);
    G_DEBUG=false;
    return ast;
  }



}

parse.Constants=Constants;
parse.exportConstants=exportConstants;
parse.RegexSyntaxError=RegexSyntaxError;
parse.getNFAParser=getNFAParser;

var _NFAParser;
function getNFAParser() {
  if (!_NFAParser) {
    _NFAParser=NFA(config,G_DEBUG);
  }
  return _NFAParser;
}

function _set(obj,prop,value) {
  Object.defineProperty(obj,prop,{
    value:value,enumerable:G_DEBUG,writable:true,configurable:true
  });
}

function _coalesceExactNode(stack) {
  var prev=stack[0];
  for (var i=1,j=1,l=stack.length,node;i<l;i++) {
    node=stack[i];
    if (node.type===EXACT_NODE) {
      if (prev.type===EXACT_NODE && !prev.repeat && !node.repeat) {
        prev.indices[1]=node.indices[1];
        prev.raw+=node.raw;
        prev.chars+=node.chars;
        continue;
      }
    } else if (node.sub) _coalesceExactNode(node.sub);
    else if (node.branches) node.branches.map(_coalesceExactNode);
    stack[j++]=node;
    prev=node;
  }
  if (prev) stack.length=j;
}

function _fixNodes(stack,re,endIndex) {
  if (!stack.length) {
    stack.push({type:EMPTY_NODE,indices:[endIndex,endIndex]});
    return;
  }
  stack.reduce(function (endIndex,node) {
    node.indices.push(endIndex);
    node.raw=re.slice(node.indices[0],endIndex);
    if (node.type===GROUP_NODE || (node.type===ASSERT_NODE && node.sub)) {
      _fixNodes(node.sub,re,node.endParenIndex);
    } else if (node.type===CHOICE_NODE) {
      node.branches.reduce(function (endIndex,branch) {
        _fixNodes(branch,re,endIndex);
        var head=branch[0]; // Reversed,so branch[0] is head.Dammit mystic code
        return (head?head.indices[0]:endIndex)-1; // skip '|'
      },endIndex);
      node.branches.reverse();
    } else if (node.type===EXACT_NODE) {
      node.chars = node.chars || node.raw;
    }
    return node.indices[0];
  },endIndex);
  stack.reverse();
}

function _checkRepeat(node) {
  if (node.repeat) {
    throw new RegexSyntaxError({
      type:'NothingRepeat',
      lastIndex:node.indices[1],
      message:'Nothing to repeat!Repeat after assertion doesn\'t make sense!'
    })
  }
}

//check charset ranges out of order error.(Because of charsetRangeEndEscape)
// [z-\u54] had to defer check
function _checkCharsetRange(node) {
  node.ranges=K.sortUnique(node.ranges.map(function (range) {
    if (range[0]>range[1]) {
      throw new RegexSyntaxError({
        type:"OutOfOrder",
        lastIndex:range.lastIndex,
        message:"Range ["+range.join('-')+"] out of order in character class!"
      });
    }
    return range.join('');
  }));
}

function RegexSyntaxError(e) {
  this.name="RegexSyntaxError";
  this.type=e.type;
  this.lastIndex=e.lastIndex;
  this.lastState=e.lastState;
  this.astStack=e.astStack;
  this.message=e.message;
  Object.defineProperty(this,'stack',{
    value:new Error(e.message).stack,enumerable:false
  });
}
RegexSyntaxError.prototype.toString=function () {
  return this.name+' '+this.type+':'+this.message;
};



var escapeCharMap={n:"\n",r:"\r",t:"\t",v:"\v",f:"\f"};

// All indices' end will be fixed later by stack[i].indices.push(stack[i+1].indices[0])
// All raw string filled later by node.raw=s.slice(node.indices[0],node.indices[1])
// All nodes are unshift to stack, so they're reverse order.
var actions=(function _() {

  function exact(stack,c,i) { //any literal string.
    // ExactNode.chars will be filled later (than raw)
    // Escape actions and repeat actions will fill node.chars
    // node.chars = node.chars || node.raw
    var last=stack[0];
    if (!last || last.type!=EXACT_NODE || last.repeat || last.chars)
      stack.unshift({type:EXACT_NODE, indices:[i]});
  }
  function dot(stack,c,i) { //   /./
    stack.unshift({type:DOT_NODE,indices:[i]});
  }
  function nullChar(stack,c,i) {
    c="\0";
    exact(stack,c,i);
  }
  function assertBegin(stack,c,i) { //  /^/
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i],
      assertionType:AssertBegin
    });
  }
  function assertEnd(stack,c,i,state,s) {
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i],
      assertionType:AssertEnd
    });
  }
  function assertWordBoundary(stack,c,i) {//\b \B assertion
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i-1],
      assertionType: c=='b'?AssertWordBoundary:AssertNonWordBoundary
    });
  }
  function repeatnStart(stack,c,i) { //  /a{/
    //Treat repeatn as normal exact node,do transfer in repeatnEnd action.
    //Because /a{+/ is valid.
    var last=stack[0];
    if (last.type===EXACT_NODE) {
      return;
    } else { // '[a-z]{' is valid
      stack.unshift({type:EXACT_NODE,indices:[i]});
    }
  }

  function repeatnComma(stack,c,i) { // /a{n,}/
    var last=stack[0];
    _set(last,'_commaIndex',i);
  }
  function repeatnEnd(stack,c,i,state,s) { // /a{n,m}/
    var last=stack[0],charEndIndex=s.lastIndexOf('{',i);
    var min=parseInt(s.slice(charEndIndex+1,last._commaIndex || i),10);
    var max;
    if (!last._commaIndex) { // /a{n}/
      max=min;
    } else {
      if (last._commaIndex+1==i) { // /a{n,}/
        max=Infinity;
      } else {
        max=parseInt(s.slice(last._commaIndex+1,i),10);
      }
      if (max < min) {
        throw new RegexSyntaxError({
          type:"OutOfOrder",lastState:state,
          lastIndex:i,astStack:stack,
          message:"Numbers out of order in {} quantifier!"
        });
      }
      delete last._commaIndex;
    }
    if (last.indices[0]>=charEndIndex) {
      stack.shift();
    }
    _repeat(stack,min,max,charEndIndex,s);
  }
  function repeat0(stack,c,i,state,s) { _repeat(stack,0,Infinity,i,s) } // e.g. /a*/
  function repeat01(stack,c,i,state,s) { _repeat(stack,0,1,i,s) } // e.g. /a?/
  function repeat1(stack,c,i,state,s) { _repeat(stack,1,Infinity,i,s) } // e.g. /a+/
  function _repeat(stack,min,max,charEndIndex,s) {
    var last=stack[0],repeat={min:min,max:max,nonGreedy:false},
        charIndex=charEndIndex-1;
    if (last.chars && last.chars.length===1) charIndex=last.indices[0];
    if (last.type===EXACT_NODE) { // exact node only repeat last char
      var a={
        type:EXACT_NODE,
        repeat:repeat,chars:last.chars?last.chars:s[charIndex],
        indices:[charIndex]
      };
      if (last.indices[0]===charIndex) stack.shift(); // e.g. /a{n}/ should be only single node
      stack.unshift(a);
    } else {
      last.repeat=repeat;
    }
    _set(repeat,'beginIndex',charEndIndex-stack[0].indices[0]);
  }
  function repeatNonGreedy(stack) { stack[0].repeat.nonGreedy=true}
  function normalEscape(stack,c,i) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    stack.unshift({
      type:EXACT_NODE,chars:c,indices:[i-1]
    });
  }
  function charClassEscape(stack,c,i) {
    stack.unshift({
      type:CHARSET_NODE,indices:[i-1],chars:'',ranges:[],
      classes:[c],exclude:false
    });
  }
  function hexEscape(stack,c,i,state,s) {
    c=String.fromCharCode(parseInt(s[i-1]+c,16));
    stack.unshift({
      type:EXACT_NODE, chars:c,
      indices:[i-3] // \xAA length-1
    });
  }
  function unicodeEscape(stack,c,i,state,s) {
    c=String.fromCharCode(parseInt(s.slice(i-3,i+1),16));
    stack.unshift({
      type:EXACT_NODE, chars:c,
      indices:[i-5] // \u5409 length-1
    });
  }
  function groupStart(stack,c,i) {
    var counter=(stack.groupCounter=(stack.groupCounter || {i:0}));
    counter.i++;
    var group={
      type:GROUP_NODE,
      num: counter.i,
      sub:[], indices:[i],
      _parentStack:stack // Used to restore current stack when group end,viz. encounters ")"
    };
    stack=group.sub;
    _set(stack,'_parentGroup',group);
    stack.groupCounter=counter; //keep groupCounter persist and ref modifiable
    return stack;
  }
  function groupNonCapture(stack) { // /(?:)/\
    var group=stack._parentGroup
    group.nonCapture=true;
    group.num=undefined;
    stack.groupCounter.i--;
  }
  function groupToAssertion(stack,c,i) { // Convert /(?!)/,/(?=)/ to AssertNode
    var group=stack._parentGroup;
    group.type=ASSERT_NODE;
    group.assertionType= c=='=' ? AssertLookahead : AssertNegativeLookahead ;
    // Caveat!!! Assertion group no need to capture
    group.num=undefined;
    stack.groupCounter.i--;
  }
  function groupEnd(stack,c,i,state,s) {
    stack=endChoice(stack); // restore group's stack from choice
    var group=stack._parentGroup;
    if (!group) {
      throw new RegexSyntaxError({
        type:'UnexpectedChar',
        lastIndex:i,
        lastState:state,
        astStack:stack,
        message:"Unexpected end parenthesis!"
      });
    }
    delete stack._parentGroup; // Be generous,I don't care sparse object performance.
    delete stack.groupCounter; // clean
    stack=group._parentStack;  // restore stack
    delete group._parentStack;
    stack.unshift(group);
    group.endParenIndex=i;
    return stack;
  }
  function choice(stack,c,i) { // encounters "|"
    //replace current stack with choices new branch stack
    var newStack=[],choice;
    if (stack._parentChoice) {
      choice=stack._parentChoice;
      choice.branches.unshift(newStack);
      _set(newStack,'_parentChoice',choice);
      _set(newStack,'_parentGroup',choice);
      newStack.groupCounter=stack.groupCounter; // keep track
      delete stack._parentChoice;
      delete stack.groupCounter;  // This stack is in choice.branches,so clean it
    } else { //  "/(a|)/" ,create new ChoiceNode
      var first=stack[stack.length-1]; // Because of stack is reverse order
      choice={
        type:CHOICE_NODE,indices:[(first?first.indices[0]:i-1)],
        branches:[]
      };
      _set(choice,'_parentStack',stack);
      choice.branches.unshift(stack.slice()); // contents before "|"
      stack.length=0;
      /* e.g. "/(a|b)/" is {
        type:'group',sub:[
          {type:'choice',branches:[
              [{type:'exact',chars:'a'}],
              [{type:'exact',chars:'b'}]
          ]}]}*/
      stack.unshift(choice); // must not clean groupCounter

      newStack.groupCounter=stack.groupCounter;
      _set(newStack,'_parentChoice',choice);
      _set(newStack,'_parentGroup',choice);
      choice.branches.unshift(newStack);
    }
    return newStack;
  }
  //if current stack is a choice's branch,return the original parent stack
  function endChoice(stack) {
    if (stack._parentChoice) {
      var choice=stack._parentChoice;
      delete stack._parentChoice;
      delete stack._parentGroup;
      delete stack.groupCounter;
      var parentStack=choice._parentStack;
      delete choice._parentStack;
      return parentStack;
    }
    return stack;
  }
  function charsetStart(stack,c,i) {
    stack.unshift({
      type:CHARSET_NODE,indices:[i],
      classes:[],ranges:[],chars:''
    });
  }
  function charsetExclude(stack) {stack[0].exclude=true}
  function charsetContent(stack,c,i) {stack[0].chars+=c}
  function charsetNormalEscape(stack,c,i) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    stack[0].chars+=c;
  }
  function charsetNullChar(stack,c,i) {
    stack[0].chars+="\0";
  }
  function charsetClassEscape(stack,c) {
    stack[0].classes.push(c);
  }
  function charsetHexEscape(stack,c,i,state,s) {
    var last=stack[0];
    c=String.fromCharCode(parseInt(last.chars.slice(-1)+c,16));
    last.chars=last.chars.slice(0,-2); // also remove "xA"
    last.chars+=c;
  }
  function charsetUnicodeEscape(stack,c,i,state,s) {
    var last=stack[0];
    c=String.fromCharCode(parseInt(last.chars.slice(-3)+c,16));
    last.chars=last.chars.slice(0,-4); //remove "uABC"
    last.chars+=c;
  }

  function charsetRangeEnd(stack,c,i,state,s) {
    var charset=stack[0];
    var range=charset.chars.slice(-2);
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
    charset.chars=charset.chars.slice(0,-2);
  }
  function charsetRangeEndNormalEscape(stack,c) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    charsetRangeEnd.apply(this,arguments);
  }
  // [\x30-\x78] first repr as {ranges:['\x30','x']}
  // [\u0000-\u4567] first repr as {ranges:['\0','u']}
  // If escape sequences are valid then replace range end with corrent char
  // stack[0].chars did not contain 'u' or 'x'
  function charsetRangeEndUnicodeEscape(stack,c,i) {
    var charset=stack[0];
    var code=charset.chars.slice(-3)+c;
    charset.chars=charset.chars.slice(0,-3); // So just remove previous three,no 'u'
    var range=charset.ranges.pop();
    c=String.fromCharCode(parseInt(code,16));
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
  }
  function charsetRangeEndHexEscape(stack,c,i) {
    var charset=stack[0];
    var code=charset.chars.slice(-1)+c;
    charset.chars=charset.chars.slice(0,-1); // last.chars does'nt contain 'x'
    var range=charset.ranges.pop();
    c=String.fromCharCode(parseInt(code,16));
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
  }


  /* Caveat!!!
  See:https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/RegExp
       \0  Matches a NUL character. Do not follow this with another digit.
  ECMA-262 Standard: 15.10.2.11 DecimalEscape
  NOTE
    If \ is followed by a decimal number n whose first digit is not 0, then the escape sequence is considered to be
    a backreference. It is an error if n is greater than the total number of left capturing parentheses in the entire regular
    expression. \0 represents the <NUL> character and cannot be followed by a decimal digit.

  But in both Chrome and Firefox, /\077/ matches "\077",e.g. String.fromCharCode(parseInt("77",8))
    /(g)\1/ matches "gg",it's OK.
    But /(g)\14/ matches "g\14","\14" is String.fromCharCode(parseInt("14",8))
    And /(g)\1456/ matches "g\145"+"6",/(g)\19/ matches "g\1"+"9". Who knows WTF?
    Considering that ECMAScript StrictMode did not support OctEscape,
    I'm not going to implement OctEscape.

  I will make it conform the Standard.(Also keep code simple)
  */
  function backref(stack,c,i,state) {
    var last=stack[0],n=parseInt(c,10),
        isFirstNum=state==='escape',
        counter=stack.groupCounter,
        cn=(counter && counter.i) || 0;

    if (!isFirstNum) { //previous node must be backref node
      n=parseInt(last.num+""+n,10);
    } else {
      last={type:BACKREF_NODE,indices:[i-1]};
      stack.unshift(last);
    }
    if (n>cn) {
      throw new RegexSyntaxError({
        type:'InvalidBackReference',lastIndex:i,astStack:stack,lastState:state,
        message:'Back reference number('+n+') greater than current groups count('+cn+').'
      });
    } else if (_isRecursive(n,stack)) {
      throw new RegexSyntaxError({
        type:'InvalidBackReference',lastIndex:i,astStack:stack,lastState:state,
        message:'Recursive back reference in group ('+n+') itself.'
      });
    }
    last.num=n;

    function _isRecursive(n,stack) {
      if (!stack._parentGroup) return false;
      if (stack._parentGroup.num==n) return n;
      return _isRecursive(n,stack._parentGroup._parentStack);
    }
  }

  //console.log(K.locals(_));

  return {
    exact:exact,dot:dot,nullChar:nullChar,assertBegin:assertBegin,
    assertEnd:assertEnd,assertWordBoundary:assertWordBoundary,
    repeatnStart:repeatnStart,repeatnComma:repeatnComma,repeatNonGreedy:repeatNonGreedy,
    repeatnEnd:repeatnEnd,repeat1:repeat1,repeat01:repeat01,repeat0:repeat0,
    charClassEscape:charClassEscape,normalEscape:normalEscape,
    unicodeEscape:unicodeEscape,hexEscape:hexEscape,charClassEscape:charClassEscape,
    groupStart:groupStart,groupNonCapture:groupNonCapture,backref:backref,
    groupToAssertion:groupToAssertion,groupEnd:groupEnd,
    choice:choice,endChoice:endChoice,
    charsetStart:charsetStart,charsetExclude:charsetExclude,
    charsetContent:charsetContent,charsetNullChar:charsetNullChar,
    charsetClassEscape:charsetClassEscape,
    charsetHexEscape:charsetHexEscape,
    charsetUnicodeEscape:charsetUnicodeEscape,
    charsetRangeEnd:charsetRangeEnd,charsetNormalEscape:charsetNormalEscape,
    charsetRangeEndNormalEscape:charsetRangeEndNormalEscape,
    charsetRangeEndUnicodeEscape:charsetRangeEndUnicodeEscape,
    charsetRangeEndHexEscape:charsetRangeEndHexEscape
  };

})();

var digit='0-9';
var hexDigit='0-9a-fA-F';

//EX,It is an exclusive charset
var exactEXCharset='^+*?^$.|(){[\\';

var charClassEscape='dDwWsS';
var unicodeEscape='u';
var hexEscape='x';
//var octDigit='0-7';
//var octEscape='0-7'; Never TODO. JavaScript doesn't support string OctEscape in strict mode.

// In charset,\b\B means "\b","\B",not word boundary
// NULL Escape followed digit should throw error
var normalEscapeInCharsetEX='^'+charClassEscape+unicodeEscape+hexEscape+'0-9';

// 'rntvf\\' escape ,others return raw
// Also need exclude \b\B assertion and backref
var normalEscapeEX=normalEscapeInCharsetEX+'bB1-9';

//var controlEscape;//Never TODO.Same reason as OctEscape.


var repeatnStates='repeatnStart,repeatn_1,repeatn_2,repeatnErrorStart,repeatnError_1,repeatnError_2';
var hexEscapeStates='hexEscape1,hexEscape2';
var unicodeEscapeStates='unicodeEscape1,unicodeEscape2,unicodeEscape3,unicodeEscape4';

var allHexEscapeStates=hexEscapeStates+','+unicodeEscapeStates;

var charsetIncompleteEscapeStates='charsetUnicodeEscape1,charsetUnicodeEscape2,charsetUnicodeEscape3,charsetUnicodeEscape4,charsetHexEscape1,charsetHexEscape2';

// [a-\u1z] means [a-u1z], [a-\u-z] means [-za-u]
// [a-\u0-9] means [a-u0-9]. WTF!
var charsetRangeEndIncompleteEscapeFirstStates='charsetRangeEndUnicodeEscape1,charsetRangeEndHexEscape1';

var charsetRangeEndIncompleteEscapeRemainStates='charsetRangeEndUnicodeEscape2,charsetRangeEndUnicodeEscape3,charsetRangeEndUnicodeEscape4,charsetRangeEndHexEscape2';

var charsetRangeEndIncompleteEscapeStates=charsetRangeEndIncompleteEscapeFirstStates+','+charsetRangeEndIncompleteEscapeRemainStates;

var config={
  compact:true,
  accepts:'start,begin,end,repeat0,repeat1,exact,repeatn,repeat01,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates),
  trans:[
    ['start,begin,end,exact,repeatNonGreedy,repeat0,repeat1,repeat01,groupStart,groupQualifiedStart,choice,repeatn>exact',exactEXCharset,actions.exact],
    // e.g. /\u54/ means /u54/
    [allHexEscapeStates+'>exact',exactEXCharset+hexDigit,actions.exact],
    // e.g. /\0abc/ is exact "\0abc",but /\012/ is an error
    ['nullChar>exact',exactEXCharset+digit,actions.exact],
    //[(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>exact',exactEXCharset+'']
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',start,begin,end,exact,repeatNonGreedy,repeat0,repeat1,repeat01,groupStart,groupQualifiedStart,choice,repeatn>exact','.',actions.dot],
    ['start,groupStart,groupQualifiedStart,end,begin,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates+'>begin','^',actions.assertBegin],
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',exact>repeatnStart','{',actions.repeatnStart],
    ['start,begin,end,groupQualifiedStart,groupStart,repeat0,repeat1,repeatn,repeat01,repeatNonGreedy,choice>repeatnErrorStart','{',actions.exact],//No repeat,treat as exact char e.g. /{/,/^{/,/a|{/
    ['repeatnStart>repeatn_1',digit,actions.exact], // Now maybe /a{1/
    ['repeatn_1>repeatn_1',digit,actions.exact], // Could be /a{11/
    ['repeatn_1>repeatn_2',',',actions.repeatnComma], // Now maybe /a{1,/
    ['repeatn_2>repeatn_2',digit,actions.exact], // Now maybe /a{1,3/
    ['repeatn_1,repeatn_2>repeatn','}',actions.repeatnEnd], //Totally end /a{1,3}/
    //Repeat treat as exact chars
    ['repeatnStart,repeatnErrorStart>exact','}',actions.exact], // e.g. /{}/,/a{}/
    //Add exclusion 0-9 and "}", e.g. /a{a/,/a{,/ are valid exact match
    ['repeatnStart,repeatnErrorStart>exact',exactEXCharset+'0-9}',actions.exact],

    // "/{}/" is valid exact match but /{1,2}/ is error repeat.
    // So must track it with states repeatnError_1,repeatnError_2
    ['repeatnErrorStart>repeatnError_1',digit,actions.exact],
    ['repeatnError_1>repeatnError_1',digit,actions.exact],
    ['repeatnError_1>repeatnError_2',',',actions.exact],
    ['repeatnError_2>repeatnError_2',digit,actions.exact],
    // repeatErrorFinal is an unacceptable state. Nothing to repeat error should be throwed
    ['repeatnError_2,repeatnError_1>repeatErrorFinal','}'],

    // "/a{2a/" and "/{2a/" are valid exact match
    ['repeatn_1,repeatnError_1>exact',exactEXCharset+digit+',}',actions.exact],
    // "/a{2,a/" and "/{3,a" are valid
    ['repeatn_2,repeatnError_2>exact',exactEXCharset+digit+'}',actions.exact],

    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat0','*',actions.repeat0],
    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat1','+',actions.repeat1],
    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat01','?',actions.repeat01],
    ['choice>repeatErrorFinal','*+?'],
    ['repeat0,repeat1,repeat01,repeatn>repeatNonGreedy','?',actions.repeatNonGreedy],
    ['repeat0,repeat1,repeat01,repeatn>repeatErrorFinal','+*'],

    // Escape
    ['start,begin,end,groupStart,groupQualifiedStart,exact,repeatNonGreedy,repeat0,repeat1,repeat01,repeatn,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>escape','\\'],
    ['escape>nullChar','0',actions.nullChar],
    ['nullChar>digitFollowNullError','0-9'], // "/\0123/" is invalid in standard
    ['escape>exact',normalEscapeEX,actions.normalEscape],
    ['escape>exact','bB',actions.assertWordBoundary],
    ['escape>exact',charClassEscape,actions.charClassEscape],
    ['escape>unicodeEscape1',unicodeEscape,actions.exact],
    ['unicodeEscape1>unicodeEscape2',hexDigit,actions.exact],
    ['unicodeEscape2>unicodeEscape3',hexDigit,actions.exact],
    ['unicodeEscape3>unicodeEscape4',hexDigit,actions.exact],
    ['unicodeEscape4>exact',hexDigit,actions.unicodeEscape],
    ['escape>hexEscape1',hexEscape,actions.exact],
    ['hexEscape1>hexEscape2',hexDigit,actions.exact],
    ['hexEscape2>exact',hexDigit,actions.hexEscape],

    ['escape>digitBackref','1-9',actions.backref],
    ['digitBackref>digitBackref',digit,actions.backref],
    ['digitBackref>exact',exactEXCharset+digit,actions.exact],

    // Group start
    ['exact,begin,end,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,start,groupStart,groupQualifiedStart,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>groupStart','(',actions.groupStart],
    ['groupStart>groupQualify','?'],
    ['groupQualify>groupQualifiedStart',':',actions.groupNonCapture],//group non-capturing
    ['groupQualify>groupQualifiedStart','=',actions.groupToAssertion],//group positive lookahead
    ['groupQualify>groupQualifiedStart','!',actions.groupToAssertion],//group negative lookahead
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',groupStart,groupQualifiedStart,begin,end,exact,repeat1,repeat0,repeat01,repeatn,repeatNonGreedy,choice>exact',')',actions.groupEnd],//group end

    //choice
    ['start,begin,end,groupStart,groupQualifiedStart,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>choice','|', actions.choice],

    ['start,groupStart,groupQualifiedStart,begin,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>end','$',actions.assertEnd],

    // Charset [HA-HO]
    ['exact,begin,end,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,groupQualifiedStart,groupStart,start,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>charsetStart','[',actions.charsetStart],
    ['charsetStart>charsetExclude','^',actions.charsetExclude],
    ['charsetStart>charsetContent','^\\]^',actions.charsetContent],
    ['charsetExclude>charsetContent','^\\]',actions.charsetContent], // "[^^]" is valid
    ['charsetContent,charsetClass>charsetContent','^\\]-',actions.charsetContent],
    ['charsetClass>charsetContent','-',actions.charsetContent],


    // Charset Escape
    [charsetIncompleteEscapeStates+
      ',charsetStart,charsetContent,charsetClass,charsetExclude,charsetRangeEnd>charsetEscape','\\'],
    ['charsetEscape>charsetContent',normalEscapeInCharsetEX,actions.charsetNormalEscape],
    ['charsetEscape>charsetNullChar','0',actions.charsetNullChar],

    //Didn't allow oct escape
    ['charsetEscape>charsetOctEscape','1-9'],
    ['charsetRangeEndEscape>charsetOctEscape','1-9'],
    //Treat /[\012]/ as an error
    ['charsetNullChar>digitFollowNullError',digit],
    // Only null char not followed by digit is valid
    ['charsetNullChar>charsetContent','^0-9\\]-',actions.charsetContent],

    // charsetClass state should diff from charsetContent
    // Because /[\s-a]/ means /[-a\s]/
    ['charsetEscape>charsetClass',charClassEscape,actions.charsetClassEscape],

    ['charsetEscape>charsetUnicodeEscape1',unicodeEscape,actions.charsetContent],
    ['charsetUnicodeEscape1>charsetUnicodeEscape2',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape2>charsetUnicodeEscape3',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape3>charsetUnicodeEscape4',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape4>charsetContent',hexDigit,actions.charsetUnicodeEscape],
    ['charsetEscape>charsetHexEscape1',hexEscape,actions.charsetContent],
    ['charsetHexEscape1>charsetHexEscape2',hexDigit,actions.charsetContent],
    ['charsetHexEscape2>charsetContent',hexDigit,actions.charsetHexEscape],

    //  [a\u54-9] should be treat as [4-9au5]
    [charsetIncompleteEscapeStates+'>charsetContent','^\\]'+hexDigit+'-',actions.charsetContent],

    [charsetIncompleteEscapeStates+',charsetNullChar,charsetContent>charsetRangeStart','-',actions.charsetContent],
    ['charsetRangeStart>charsetRangeEnd','^\\]',actions.charsetRangeEnd],
    ['charsetRangeEnd>charsetContent','^\\]',actions.charsetContent],


    // Some troubles here, [0-\x39] means [0-9]
    ['charsetRangeStart>charsetRangeEndEscape','\\'],
    ['charsetRangeEndEscape>charsetRangeEnd',normalEscapeEX,actions.charsetRangeEndNormalEscape],
    // No need to care [a-\0],it is not a valid range so will throw OutOfOrder error.
    // But what about [\0-\0]? Insane!
    ['charsetRangeEndEscape>charsetRangeEndWithNullChar','0'],

    ['charsetRangeEndEscape>charsetRangeEndUnicodeEscape1',unicodeEscape,actions.charsetRangeEnd],
    ['charsetRangeEndUnicodeEscape1>charsetRangeEndUnicodeEscape2',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape2>charsetRangeEndUnicodeEscape3',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape3>charsetRangeEndUnicodeEscape4',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape4>charsetRangeEnd',hexDigit,actions.charsetRangeEndUnicodeEscape],
    ['charsetRangeEndEscape>charsetRangeEndHexEscape1',hexEscape,actions.charsetRangeEnd],
    ['charsetRangeEndHexEscape1>charsetRangeEndHexEscape2',hexDigit,actions.charsetContent],
    ['charsetRangeEndHexEscape2>charsetRangeEnd',hexDigit,actions.charsetRangeEndHexEscape],
    // [0-\w] means [-0\w]? Should throw error!
    ['charsetRangeEndEscape>charsetRangeEndClass',charClassEscape],

    // [a-\uz] means [za-u],[a-\u-z] means [-za-u]
    [charsetRangeEndIncompleteEscapeFirstStates+'>charsetContent','^\\]'+hexDigit,actions.charsetContent],

    // [a-\u0-9] means [0-9a-u]
    [charsetRangeEndIncompleteEscapeRemainStates+'>charsetRangeStart','-',actions.charsetContent],
    [charsetIncompleteEscapeStates+','
      +charsetRangeEndIncompleteEscapeStates
      +',charsetNullChar,charsetRangeStart,charsetContent'
      +',charsetClass,charsetExclude,charsetRangeEnd>exact',
      ']']
  ]
};


return parse;
});
