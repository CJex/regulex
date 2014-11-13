if (typeof define !== 'function') var define = require('amdefine')(module);
define(['./parse','./Kit','./NFA'],function (parse,K,NFA) {
/**
Mock RegExp class
*/
parse.exportConstants();
//options
RegExp.DEBUG=RegExp.D=1;
RegExp.MULTILINE=RegExp.M=2;
RegExp.GLOBAL=RegExp.G=4;
RegExp.IGNORECASE=RegExp.I=8;
function RegExp(re,options) {
  if (!(this instanceof RegExp)) return new RegExp(re,options);
  re=re+'';
  var opts={};
  if (typeof options==='string') {
    options=options.toLowerCase();
    if (~options.indexOf('i')) opts.ignoreCase=true;
    if (~options.indexOf('m')) opts.multiline=true;
    if (~options.indexOf('g')) opts.global=true;
    if (~options.indexOf('d')) opts.debug=true;
  } else {
    opts=options;
  }

  var ast=this.ast=parse(re);
  this.source=re;
  this.multiline=!!opts.multiline;
  this.global=!!opts.global;
  this.ignoreCase=!!opts.ignoreCase;
  this.debug=!!opts.debug;
  this.flags='';
  if (this.multiline) this.flags+='m';
  if (this.ignoreCase) this.flags+='i';
  if (this.global) this.flags+='g';
  _readonly(this,['source','options','multiline','global','ignoreCase','flags','debug']);

  var ignoreCase=this.ignoreCase;
  ast.traverse(function (node) {explainCharset(node,ignoreCase)},CHARSET_NODE);
  ast.traverse(function (node) {explainExact(node,ignoreCase)},EXACT_NODE);
  if (this.multiline) ast.traverse(multilineAssert,ASSERT_NODE);

}

RegExp.prototype={
  toString:function () {return '/'+this.source+'/'+this.flags;},
  test:function(s) {
    return this.exec(s)!==null;
  },
  exec:function (s) {
    var nfa=this.getNFA(),ret;
    var startIndex=this.global?(this.lastIndex || 0):0,max=s.length;
    for (;startIndex<max;startIndex++) {
      ret=nfa.input(s,startIndex);
      if (ret.acceptable) break;
    }
    if (!ret || !ret.acceptable) {
      this.lastIndex=0;
      return null;
    }
    var groups=new Array(this.ast.groupCount+1);
    groups[0]=s.slice(startIndex,ret.lastIndex+1);
    var stack=ret.stack;
    for (var i=1,l=groups.length;i<l;i++) {
      groups[i]=getGroupContent(stack,i,s);
    }
    this.lastIndex=ret.lastIndex+1;
    groups.index=startIndex;
    groups.input=s;
    return groups;
  },
  getNFA:function() {
    if (this._nfa) return this._nfa;
    var nfa,ast=this.ast;
    stateGUID=1;//reset state guid
    nfa=tree2NFA(ast.tree);
    nfa=NFA(nfa,this.debug);
    this._nfa=nfa;
    return nfa;
  }
};

function explainExact(node,ignoreCase) {// expand exact node to ignore case
  var ranges;
  ranges=node.chars.split('');
  if (ignoreCase) {
    ranges=ranges.map(function (c) {
      if (/[a-z]/.test(c)) return [c,c.toUpperCase()];
      else if (/[A-Z]/.test(c)) return [c,c.toLowerCase()];
      else return [c];
    });
  } else {
    ranges=ranges.map(function (c) {return [c]});
  }
  node.explained=ranges;
}

function multilineAssert(node) {
  var at=node.assertionType;
  if (at===AssertBegin || at===AssertEnd) node.multiline=true;
}

//var anyChar='\0\uffff';
var anyCharButNewline=K.parseCharset('^\n\r\u2028\u2029'); // \n \r \u2028 \u2029.But what's "\u2028" and "\u2029"
//Not used
var charClass2ranges={  //  e.g. \d\D\w\W\s\S
  d:['09'],
  w:['AZ','az','09','_'],
  s:' \f\n\r\t\v\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000'.split('')
};
['d','w','s'].forEach(function (cls) {// D W S,negate ranges
  charClass2ranges[cls.toUpperCase()]=K.negate(charClass2ranges[cls]);
});

function explainCharset(node,ignoreCase) {
  var ranges=node.chars.split('');
  ranges=ranges.concat(K.flatten2(node.classes.map(function(cls) {
    return charClass2ranges[cls];
  })));
  ranges=ranges.concat(node.ranges);
  if (ignoreCase) ranges=expandRangeIgnoreCase(ranges);
  ranges=K.classify(ranges).ranges;
  if (node.exclude) ranges=K.negate(ranges);
  ranges=K.coalesce(ranges); // compress ranges
  node.explained=ranges;
}

// expand ['Aa'] to ['az','Aa']
function expandRangeIgnoreCase(ranges) {
  return K.flatten2(ranges.map(function (r) {
    var parts=K.classify([r,'az','AZ']).map[r];
    return K.flatten2(parts.map(function (p) {
      if (/[a-z]/.test(p)) {
        return [p,p.toUpperCase()];
      } else if (/[A-Z]/.test(p)) {
        return [p,p.toLowerCase()];
      } else return [p];
    }));
  }));
}

function tree2NFA(stack,from) {
  var trans=[],accepts;
  from = from || ['start'];
  accepts=stack.reduce(function (from,node) {
    var a=node2NFA(node,from);
    trans=trans.concat(a.trans);
    return a.accepts;
  },from);
  return {accepts:accepts,trans:trans};
}

/*
return {trans:[Transition],accepts:[State]}
*/
function node2NFA(node,from) {
  if (node.repeat) {
    return repeatNFA(node,from);
  } else {
    return NFABuilders[node.type](node,from);
  }
}

function getGroupContent(stack,num,s) {
  var start,end,match;
  for (var i=0,l=stack.length,item;i<l;i++) {
    item=stack[i];
    if (item.num===num) {
      if (item.type===GROUP_CAPTURE_END) {
        end=item.index;
      } else if (item.type===GROUP_CAPTURE_START) {
        start=item.index;
        break;
      }
    }
  }
  if (start===undefined || end===undefined) return;
  return s.slice(start,end);
}

var stateGUID=0;
function newState() {return 'q'+(stateGUID++)}

var GROUP_CAPTURE_START='GroupCaptureStart';
var GROUP_CAPTURE_END='GroupCaptureEnd';

var NFABuilders=(function _() {
  function exact(node,from) {
    var ts=[],to,ranges=node.explained;
    ranges.forEach(function (range) {
      ts.push({from:from,to:(to=[newState()]),charset:range});
      from=to;
    });
    return {accepts:to,trans:ts};
  }

  function charset(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:node.explained}]};
  }
  function dot(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:anyCharButNewline}]};
  }

  function empty(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:false}]};
  }

  function group(node,from) {
    var groupStart=[newState()];
    var ts=[{
      from:from,to:groupStart,charset:false,
      action:!node.nonCapture && function _groupStart(stack,c,i) {
        stack.unshift({type:GROUP_CAPTURE_START,num:node.num,index:i});
      }
    }];

    from=groupStart;
    var a=tree2NFA(node.sub,from);
    ts=ts.concat(a.trans);
    var groupEnd=[newState()];
    ts.push({
      from:a.accepts,to:groupEnd,charset:false,
      action:!node.nonCapture && function _groupEnd(stack,c,i) {
        stack.unshift({type:GROUP_CAPTURE_END,num:node.num,index:i});
      }
    });
    return {accepts:groupEnd,trans:ts};
  }

  function backref(node,from) {
    var to=[newState()],groupNum=node.num;
    return {
      accepts:to,
      trans:[{
        from:from,to:to,charset:false,
        assert:function _aBackref(stack,c,i,state,s) {
          // static invalid backref will throw parse error
          // dynamic invalid backref will treat as literal decimal,not OctEscape
          // e.g. /(?:(\d)|-)\8/ will match "-8"
          var match=getGroupContent(stack,groupNum,s);
          if (match===undefined) {
            match=groupNum;
          }
          if (s.slice(i,i+match.length)===match) {
            return match.length;
          }
          return false;
        }
      }
    ]};
  }

  function choice(node,from) {
    var ts=[],to=[];
    node.branches.forEach(function (branch) {
      var a=tree2NFA(branch,from);
      ts=ts.concat(a.trans);
      to=to.concat(a.accepts);
    });
    return {trans:ts,accepts:to};
  }

  function assert(node,from) {
    var f;
    switch (node.assertionType) {
      case AssertBegin:
        f=node.multiline?_assertLineBegin:_assertStrBegin;
        break;
      case AssertEnd:
        f=node.multiline?_assertLineEnd:_assertStrEnd;
        break;
      case AssertWordBoundary:
        f=function _WB(_,c,i,state,s) {return _isBoundary(i,s)};
        break;
      case AssertNonWordBoundary:
        f=function _NWB(_,c,i,state,s) {return !_isBoundary(i,s)};
        break;
      case AssertLookahead:
        f=_lookahead(node);
        break;
      case AssertNegativeLookahead:
        f=_negativeLookahead(node);
        break;
    }
    return _newAssert(node,from,f);

    function _newAssert(node,from,assert) {
      var to=[newState()];
      return {
        accepts:to,
        trans:[{
          from:from,to:to,charset:false,
          assert:assert
        }]
      };
    }
    function _lookahead(node) {
      var m=NFA(tree2NFA(node.sub,['start']));
      return function _Lookahead(stack,c,i,state,s) {
        var ret=m.input(s,i,null,stack);
        return ret.acceptable;
      };
    }
    function _negativeLookahead(node) {
      var f=_lookahead(node);
      return function _NLookahead() {return !f.apply(this,arguments)};
    }

    function _isBoundary(i,s) {return !!(_isWordChar(i-1,s) ^ _isWordChar(i,s))}
    function _isWordChar(i,s) {return i!==-1 && i!==s.length && /\w/.test(s[i])}
    function _assertLineBegin(_,c,i,state,s) {return i===0 || s[i-1]==="\n"}
    function _assertStrBegin(_,c,i,state,s) {return i===0}
    function _assertLineEnd(_,c,i,state,s) {return i===s.length || c==="\n"}
    function _assertStrEnd(_,c,i,state,s) {return i===s.length}
  }

  //console.log(K.locals(_));
  return {
    assert:assert,
    choice:choice,
    backref:backref,
    group:group,
    empty:empty,
    charset:charset,
    dot:dot,
    exact:exact
  };
})();

function repeatNFA(node,from) {
  var builder=NFABuilders[node.type];
  var a,i,trans=[],repeat=node.repeat,
      min=repeat.min,max=repeat.max;
  i=min;
  while (i--) {
    a=builder(node,from);
    trans=trans.concat(a.trans);
    from=a.accepts;
  }
  var moreTrans=[];
  var accepts=[].concat(from);
  if (isFinite(max)) {
    for (;max>min;max--) {
      a=builder(node,from);
      moreTrans=moreTrans.concat(a.trans);
      from=a.accepts;
      accepts=accepts.concat(a.accepts);
    }
  } else {
    var beforeStates=from.slice();
    a=builder(node,from);
    moreTrans=moreTrans.concat(a.trans);
    accepts=accepts.concat(a.accepts);
    moreTrans.push({
      from:a.accepts,to:beforeStates,charset:false
    });
  }
  var endState=[newState()];
  if (repeat.nonGreedy) {
    trans.push({
      from:accepts,to:endState,charset:false
    });
    trans=trans.concat(moreTrans);
  } else {
    trans=trans.concat(moreTrans);
    trans.push({
      from:accepts,to:endState,charset:false
    });
  }
  return {accepts:endState,trans:trans};
}

function _readonly(obj,attrs) {
  attrs.forEach(function (a) {
    Object.defineProperty(obj,a,{writable:false,enumerable:true});
  });
}

return RegExp;

});
