if (typeof define !== 'function') var define = require('amdefine')(module);
define(['./Kit'],function (K) {

/**
A Naive NFA Implementation

Start state is always named 'start'
@param {NFAConfig|CompactNFAConfig} a
type NFAConfig = {compact:false,accepts:StateSet,trans:[Transition]}
type State = String
type StateSet = [State]
type Tranisition = {from:StateSet,to:StateSet,charset:Charset,action:Action,assert:Assert}
type Charset = String|[Range]
  Charset is similar to regex charset,supports negation and range but metacharacters
  Examples:
    includes: 'abc0-9','[^]'
    excludes: '^c-z0-9','^a^' //excluded 'a' and '^' two chars
    any char: '\0-\uffff'
  Or set charset to processed disjoint ranges:['ac','d','eh']
Set `charset` to empty string to enable empty move(ε-moves).

Action:
  Function(stack:Array,c:String,i:Int,state:String,inputs:String):Array
    stack: storage stack
    c: current char
    i: current index
    state: current state
    inputs: whole input string
  Optional return new stack

Only eMove transition allow `assert`
Actions and Asserts of eMove transition always execute before non-eMove transitions on current path.
Assert:
  Function(stack:Array,c:String,i:Int,state:String,inputs:String):Boolean
    Return True if assertion just success,if fail return false
    If success and need skip num chars,
      return the Int count to increase `i`,this feature is designed for backref.

Stack modifications in action only allow shift,unshift and return new stack.

NFAConfig example used to recognize numbers:{
  compact:false,accepts:'start'.
  trans:[{from:'start',to:'start',charset:'0-9'}]
}

CompactNFAConfig example,see `structure` function.
An automaton used to recognize triples:{
  compact:true,accepts:'start',
  trans:[
    ['start>start','0369'],['start>q1','147'],['start>q2','258'],
    ['q1>q1','0369'],['q1>q2','147'],['q1>start','258'],
    ['q2>q2','0369'],['q2>q1','258'],['q2>start','147'],
  ]
};

@return {
  input:Function
}
*/
function NFA(a) {
  a=a.compact?structure(a):a;
  var accepts={},i,trans=a.trans,
      // FMap={toState:Function}
      router={/*
        fromState : {
          eMove:[{to:State,action:Function,assert:Function,eMove:Bool}],
          eMoveStates:[State],// ε-move dest states
          charMove:{
            // expanded to include eMove
            Range:[{to:State,action:Function,assert:Function,eMove:Bool}],
            Char:[{to:State,action:Function,assert:Function,eMove:Bool}]
          },
          ranges:Set([Range]),
          // all trans keep original order in transitions list
          trans:[Transition]
        }
      */};

  for (i=0,n=a.accepts.length;i<n;i++) accepts[a.accepts[i]]=true; //add accept states

  var t;
  for (i=0,n=trans.length;i<n;i++) {//collect charsets
    t=trans[i];
    if (t.charset) t.ranges= typeof t.charset==='string'?K.parseCharset(t.charset):t.charset;
    else t.eMove=true;
    t.from.forEach(function(from) {
      var path=(router[from]=router[from] || {
        eMoveStates:[],eMove:[],charMove:{},trans:[],ranges:[]
      });
      if (t.eMove) path.eMoveStates=path.eMoveStates.concat(t.to);
      else path.ranges=path.ranges.concat(t.ranges);
      path.trans.push(t);
    });
  }
  var fromStates=Object.keys(router);
  fromStates.forEach(function (from) {
    var path=router[from],trans=path.trans,
        charMove=path.charMove,eMove=path.eMove,
        ranges=path.ranges;
    var cls=K.classify(ranges),rangeMap=cls.map;
    trans.forEach(function (t) {
      if (t.eMove) {
        t.to.forEach(function (toState) {
          eMove.push({to:toState,action:t.action,assert:t.assert,eMove:true});
        });
      } else {
        K.flatten2(t.ranges.map(function (r) {return rangeMap[r]})).forEach(function (r) {
          (charMove[r]=charMove[r] || []).push(t);
        });
      }
    });
    ranges=K.Set(cls.ranges.filter(function (rg) {return !!rg[1]}));//exclude single char
    path.ranges=ranges;
    // expand charMove to includes ε-move
    Object.keys(charMove).forEach(function (r) {
      var transChar=charMove[r];
      var transAll=[];
      trans.forEach(function (t) {
        t.to.forEach(function (toState) {
          if (t.eMove || ~transChar.indexOf(t)) transAll.push({to:toState,action:t.action,assert:t.assert,eMove:t.eMove});
        });
      });
      charMove[r]=transAll;
    });
    delete path.trans;
    delete path.eMoveStates;
  });

  return {
    accepts:accepts,
    router:router,
    input:input,
    assertDFA:assertDFA,
    accept:accept
  };
}

function accept(state) {
  return this.accepts.hasOwnProperty(state);
}

function assertDFA() {
  var router=this.router;
  var fromStates=Object.keys(router),path;
  for (var i=0,l=fromStates.length;i<l;i++) {
    path=router[fromStates[i]];
    if (path.eMove.length>1) {
      throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` can goto to multi ε-move states!");
    }
    var charMove=path.charMove;
    var ranges=Object.keys(charMove);
    for (var k=0,n=ranges.length;k<n;k++) {
      var t=charMove[ranges[k]];
      if (t.length!==1) {
        K.log(charMove);
        throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` via charset `"+ranges[k]+"` can goto to multi states!");
      }
    }
    if (ranges.length && path.eMove.length) {
      throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` can goto extra ε-move state!");
    }
  }
  return true;
}


/**
return {
    stack:Array,
    acceptable:Boolean,
    lastIndex:Int,
    lastState:String
  }
*/
function input(s,startIndex,_debug) {
  startIndex=startIndex || 0;
  var _this=this;
  return _input(s,startIndex,'start',[],startIndex-1);
  function _input(s,startIndex,fromState,stack,lastIndex) {
    recur:do {
      var c,range,advanceIndex,lastResult;
      var path=_this.router[fromState];
      if (!path) break;
      var eMove=path.eMove,charMove=path.charMove,trans;
      if (startIndex<s.length) {
        c=s[startIndex];
        if (charMove.hasOwnProperty(c)) {
          trans=charMove[c];
        } else if (range=findRange(path.ranges,c)) {
          trans=charMove[range];
        } else {
          trans=eMove;
        }
      } else {
        trans=eMove;
      }

      var sp=stack.length,t,skip,ret,oldLastIndex=lastIndex;
      for (var j=0,n=trans.length;j<n;j++) {
        t=trans[j];
        advanceIndex=t.eMove?0:1;
        lastIndex=oldLastIndex;
        stack.splice(0,stack.length-sp);
        sp=stack.length; // backup stack length
        if (t.assert) {
          if ((skip=t.assert(stack,c,startIndex,fromState,s))===false) continue;
          // For backref skip num chars
          if (typeof skip==='number') {startIndex+=skip;lastIndex+=skip;}
        }
        if (t.action) stack=t.action(stack,c,startIndex,fromState,s) || stack;
        lastIndex=t.eMove?lastIndex:startIndex;
        _debug && K.log(c+":"+fromState+">"+t.to);
        if (j===n-1) {
          startIndex+=advanceIndex;
          fromState=t.to;
          continue recur; // Human flesh tail call optimize?
        } else {
          ret=_input(s,startIndex+advanceIndex,t.to,stack,lastIndex);
        }
        if (ret.acceptable) return ret;
        lastResult=ret;
      }
      if (lastResult) return lastResult;
      break;
    } while (true);

    return {
      stack:stack,lastIndex:lastIndex,lastState:fromState,
      acceptable:_this.accept(fromState)
    };
  }
}



/** ε-closure
return closureMap {fromState:[toState]}
eMoveMap = {fromState:{to:[State]}}
*/
function eClosure(eMoves,eMoveMap) {
  var closureMap={};
  eMoves.forEach(function (state) { // FK forEach pass extra args
    closure(state);
  });
  return closureMap;

  function closure(state,_chain) {
    if (closureMap.hasOwnProperty(state)) return closureMap[state];
    if (!eMoveMap.hasOwnProperty(state)) return false;
    _chain=_chain||[state];
    var dest=eMoveMap[state],
        queue=dest.to.slice(),
        toStates=[state],s,clos;
    while (queue.length) {
      s=queue.shift();
      if (~_chain.indexOf(s)) {
        throw new Error("Recursive ε-move:"+_chain.join(">")+">"+s+"!");
      }
      clos=closure(s,_chain);
      if (clos)  queue=clos.slice(1).concat(queue);
      toStates.push(s);
    }
    return closureMap[state]=toStates;
  }
}


function findRange(ranges,c/*:Char*/) {
  var i=ranges.indexOf(c,cmpRange);
  if (!~i) return false;
  return ranges[i];
}

function cmpRange(c,rg) {
  var head=rg[0],tail=rg[1];
  if (c>tail) return 1;
  if (c<head) return -1;
  return 0;
}

/**
Convert CompactNFAConfig to NFAConfig
@param {CompactNFAConfig} a
type CompactNFAConfig={compact:true,accepts:CompactStateSet,trans:[CompactTransition]}
type CompactStateSet = StateSet.join(",")
type CompactTransition = [CompactStateMap,Charset,Action,Assert]
type CompactStateMap = FromStateSet.join(",")+">"+ToStateSet.join(",")
*/
function structure(a) {
  a.accepts=a.accepts.split(',');
  var ts=a.trans,
      i=ts.length,t,s,from,to;
  while (i--) {
    t=ts[i];
    s=t[0].split('>');
    from=s[0].split(',');
    to=s[1].split(',');
    ts[i]={from:from,to:to,charset:t[1],action:t[2],assert:t[3]};
  }
  a.compact=false;
  return a;
}


return NFA;


});
