if (typeof define !== 'function') var define = require('amdefine')(module);
define(function () {
/*Kit*/

var AP=Array.prototype,
    slice=AP.slice,
    isBrowser=(function () {
      return this.toString()==="[object Window]";
    })();


/**
Build sorted Set from array.
This function will corrupt the original array
Proper usage:a=Set(a);
@param {ArrayLike} a
@return {Set} return new ArrayLike Set
*/
function Set(a,_sorted) {
  if (a._Set) return a;
  if (!_sorted) a=sortUnique(a);

  //@returns Boolean. Detect if x is in set.
  //`cmp` is custom compare functions return -1,0,1.
  // function cmp(x,item):Ordering(LT=-1|EQ=0|GT=1);
  a.contains=function (x,cmp) {return !!~bsearch(a,x,cmp)};
  a.indexOf=function (x,cmp) {return bsearch(a,x,cmp)};
  a.toArray=function () {return copyArray(a);};

  /** Union with another Set
  @param {Set|Array} b If b is an array,it will be corrupted by sortUnqiue
  @return {Set} return new Set */
  a.union=function (b) {
    b=Set(b);
    var n=a.length+b.length,c=new a.constructor(n);
    for (var i=0,j=0,k=0;k<n;k++) {//merge
      if (a[i]===b[j]) {c[k]=a[i++];j++;n--;}
      else if (a[i]<b[j]) c[k]=a[i++];
      else c[k]=b[j++];
    }
    c.length=n;
    return Set(c.length===n?c:copyArray(c,n),true);
  };

  a.inspect=a.toArray;
  a._Set=true;
  return a;
}


var LT=-1,EQ=0,GT=1;
function _cmp(a,b) {return a<b?LT:(a===b?EQ:GT)}
function bsearch(a,x,cmp) {
  var lo=0,n=a.length,hi=n-1,pivot,c;
  if (n<1) return -1;
  cmp=cmp||_cmp;//custom compare functions
  if (n===1) return cmp(x,a[lo])===EQ ? lo : -1;
  if (cmp(x,a[lo])===LT || cmp(x,a[hi])===GT) return -1;
  do {
    pivot=lo+((hi-lo+1)>>1);
    c=cmp(x,a[pivot]);
    if (c===EQ) return pivot;
    if (c===LT) hi=pivot-1;
    else lo=pivot+1;
  } while (lo<=hi);
  return -1;
}

/**
Return sorted Set.
This function will corrupt the original array
Proper usage: a=sortUnique(a);
@param {ArrayLike} a
@return {ArrayLike} new unique sorted array
*/
function sortUnique(a) {
  var n=a.length;
  if (n<=1) return a;
  //do a shell sort
  var k=1,hi=n/3|0,i,j,tmp;
  while (k < hi) k=k*3+1;
  while (k > 0) {
    for (i=k;i<n;i++) {
      for (j=i;j>=k && a[j]<a[j-k];j-=k) {
        tmp=a[j]; a[j]=a[j-k]; a[j-k]=tmp;
      }
    }
    k=k/3|0;
  }

  var last=a[0],x;
  for (i=1,j=1;i<n;i++) {
    x=a[i];
    if (x===last) continue;
    last=a[j++]=a[i];
  }
  a.length=j;
  return a.length===j?a:copyArray(a,j); //Typed Array length property only has a getter
}

function copyArray(a,size) {
  size=typeof size==='undefined'?a.length:size;
  var ret=new a.constructor(size),i=size;
  while(i--) ret[i]=a[i];
  return ret;
}

/**
Unique by toString.
This function will corrupt the original array but preserve the original order.
*/
function hashUnique(a) {
  var table={},i=0,j=0,l=a.length,x;
  for (;i<l;i++) {
    x=a[i];
    if (table.hasOwnProperty(x)) continue;
    table[x]=1;
    a[j++]=x;
  }
  a.length=j;
  return a;
}


/**
Object id unique.
This function will corrupt the original array.
Correct usage: a=idUnique(a);
@param {[Object]} NonPrimitive Array
*/
function idUnique(a) {
  var i,j,l=a.length,p,
      guid=(Math.random()*1E10).toString(32)+(+new Date).toString(32);
  for (i=j=0;i<l;i++) {
    p = a[i];
    if (p==null) continue;
    if (p.hasOwnProperty(guid)) continue;
    Object.defineProperty(p,guid,{
      value:1,enumerable:false
    });
    a[j++]=p;
  }
  i=j;
  while (i--) {//clean guid
    a[i][guid]=undefined;
  }
  a.length=j;
  return a;
}

/**
Classify charsets to non-overlapping sorted disjoint ranges.
@param {[Range]}
@return {ranges:DisjointRanges,map:OriginalRangesToDisjoinRangesMap}
Example: classify(['az','09','a','bb']) => {
  ranges:['a','b','cz','09'],
  map:{'az':['a','b','cz'],'09':['09'],'a':['a'],'b':['b']}
}
*/
function classify(ranges) {
  ranges=ranges.map(function (c) {return (!c[1])?c+c:c;});
  var i,j,k,l,r,n;
  ranges=sortUnique(ranges); n=ranges.length;
  var singleMap={},headMap={},tailMap={},head,tail;
  for (i=0;i<n;i++) {
    r=ranges[i]; tail=r[1]; headMap[r[0]]=true; tailMap[tail]=true;
    for (j=i;j<n;j++) {
      head=ranges[j][0];
      if (head>=tail) {
        if (head===tail) singleMap[tail]=true;
        break;
      }
    }
  }
  var chars=sortUnique(ranges.join('').split('')),
      results=Object.keys(singleMap),
      c=chars[0],tmpMap={},map={};
  for (i=0;i<n;i++) tmpMap[ranges[i]]=[];
  if (singleMap.hasOwnProperty(c)) {
    for (i=0;i<n;i++) {
      r=ranges[i];
      if (r[0]===c) tmpMap[r].push(c);
      else if (r[0]>c) break;
    }
  }
  for (i=0,k=0,l=chars.length-1;i<l;i++) {
    head=chars[i]; tail=chars[i+1];
    if (tailMap.hasOwnProperty(head)) head=succ(head);
    if (headMap.hasOwnProperty(tail)) tail=pred(tail);
    if (head<=tail) {
      c=head===tail?head:(head+tail);
      for (j=k;j<n;j++) {
        r=ranges[j];
        if (r[0]>tail) break;
        if (r[0]<=head && tail<=r[1]) tmpMap[r].push(c),results.push(c);
      }
    }
    head=chars[i]; tail=chars[i+1]; //keep insert order,push single char later
    if (singleMap.hasOwnProperty(tail)) {
      for (j=k;j<n;j++) {
        r=ranges[j];
        if (r[1]<head) k++; //skip lesser ranges
        if (r[0]>tail) break;
        if (r[0]<=tail && tail<=r[1]) tmpMap[r].push(tail);
      }
    }
  }
  results=sortUnique(results);
  for (k in tmpMap) map[k[0]===k[1]?k[0]:k]=tmpMap[k];
  return {ranges:results,map:map};
}


//@deprecated
function ____classify(ranges) {
  var stack=[],map={},
      chars=sortUnique(ranges.join('').split(''));
  chars.reduce(function (prev,c) {
    var head,tail,choosed=[];
    ranges=ranges.filter(function (rg) {//side affects filter
      var start=rg[0],end=rg[1] || start;
      head = head || start==c;
      tail = tail || end==c;
      if (start<=c && c<=end) choosed.push(rg);
      if (end >= c ) return true;
    });
    if (!choosed.length) return c;
    var last=stack[stack.length-1],valid,newRange,
        start=(last && (last[1] || last[0])==prev)?succ(prev):prev,
        end=head?pred(c):c;
    if (start<=end) {
      newRange=start==end?start:start+end;
      choosed.forEach(function (rg) {
        if (rg[0]<=start && rg.slice(-1)>=end) {
          (map[rg]=map[rg] || []).push(newRange);
          valid=true;
        }
      });
      if (valid) stack.push(newRange);
    }
    if (head && tail) {
      stack.push(c);
      choosed.forEach(function (rg) {(map[rg]=map[rg] || []).push(c)});
    }
    return c;
  },chars[0]);

  return {ranges:stack,map:map};
}


/**
Convert exclude ranges to include ranges
Example: ^b-y, ['by'] to ["\0a","z\uffff"]
@param {[Range]}
@return Sorted disjoint ranges
*/
function negate(ranges /*:[Range rg]*/) {
  var MIN_CHAR="\u0000",
      // work around UglifyJS's bug
      // it will convert unicode escape to raw char
      // that will cause error in IE
      // because IE recognize "\uFFFF" in source code as "\uFFFD"
      MAX_CHAR=JSON.parse('"\\uFFFF"');

  ranges=classify(ranges).ranges;
  var negated=[];
  if (!ranges.length) return negated;
  if (ranges[0][0]!==MIN_CHAR) ranges.unshift(MAX_CHAR);
  var hi=ranges.length-1;
  if ((ranges[hi][1] || ranges[hi][0])!==MAX_CHAR) ranges.push(MIN_CHAR);
  ranges.reduce(function (acc,r) {
    var start=succ(acc[1] || acc[0]),end=pred(r[0]);
    if (start<end) negated.push(start+end);
    if (start===end) negated.push(start);
    return r;
  });
  return negated;
}

/**
Parse simple regex style charset string like '^a-bcdf' to disjoint ranges.
Character classes like "\w\s" are not supported!
@param {String} charset  Valid regex charset [^a-z0-9_] input as "^a-z0-9_".
@return {[Range]} return sorted disjoint ranges
*/
function parseCharset(charset /*:String*/) {
  charset=charset.split('');
  var chars=[],ranges=[],
      exclude = charset[0]==='^' && charset.length > 1 && charset.shift();
  charset.forEach(function (c) {
    if (chars[0]=='-' && chars.length>1) {//chars=['-','a'],c=='z'
      if (chars[1] > c ) // z-a  is invalid
        throw new Error('Charset range out of order:'+chars[1]+'-'+c+'!');
      ranges.push(chars[1]+c);
      chars.splice(0,2);
    } else chars.unshift(c);
  });
  ranges=ranges.concat(chars);
  //convert exclude to include
  return exclude?negate(ranges):classify(ranges).ranges;
}

/**
Coalesce closed ranges.
['ac','d','ez'] will be coalesced to ['az']
@param {[Range]} ranges Sorted disjoint ranges return by `classify`.
@return {[Range]} Compressed ranges
*/
function coalesce(ranges) {
  if (!ranges.length) return [];
  var results=[ranges[0]];
  ranges.reduce(function (a,b) {
    var prev=results.length-1;
    if (a[a.length-1]===pred(b[0])) {
      return results[prev]=results[prev][0]+b[b.length-1];
    }
    results.push(b);
    return b;
  });
  return results;
}

function chr(n) {return String.fromCharCode(n)}
function ord(c) {return c.charCodeAt(0)}
function pred(c) {return String.fromCharCode(c.charCodeAt(0)-1)}
function succ(c) {return String.fromCharCode(c.charCodeAt(0)+1)}

var printEscapeMap={
  "\n":"\\n","\t":"\\t","\f":"\\f",
  "\r":"\\r"," ":" ","\\":"\\\\"
};
// Convert string to printable,replace all control chars and unicode to hex escape
function toPrint(s,isRaw) {
  var ctrl=/[\x00-\x1F\x7F-\x9F]/,unicode=/[\u009F-\uFFFF]/;
  s=s.split('').map(function (c) {
    if (!isRaw && printEscapeMap.hasOwnProperty(c)) return printEscapeMap[c];
    else if (ctrl.test(c)) return '\\x'+ord(c).toString(16).toUpperCase();
    else if (unicode.test(c)) return '\\u'+('00'+ord(c).toString(16).toUpperCase()).slice(-4);
    return c;
  }).join('');
  return s;
}
//flatten two-dimensional array to one-dimension
function flatten2(a) {return [].concat.apply([],a)}
function repeats(s,n) {return new Array(n+1).join(s)}

function log() {
  var a=slice.call(arguments);
  if (isBrowser) {
    Function.prototype.apply.apply(console.log,[console,a]);
  } else {//Assume it is Node.js
    var s='util';
    var util=require(s); // skip require.js
    a.forEach(function (x) {
      console.log(util.inspect(x,{
        showHidden:false,customInspect:true,
        depth:64,colors:true
      }));
    });

  }
}

function locals(f) {
  var src=f.toString();
  var re=/^\s+function\s+([a-zA-Z]\w+)\s*\(/mg;
  var fns=[],match;
  while (match=re.exec(src)) fns.push(match[1]);
  var methods=[],f;
  while (f=fns.pop()) methods.push(f+':'+f);
  return '{\n'+methods.join(',\n')+'\n}';
}

return {
  sortUnique:sortUnique,
  idUnique:idUnique,hashUnique:hashUnique,
  Set:Set, repeats:repeats,
  negate:negate,coalesce:coalesce,
  classify:classify,
  parseCharset:parseCharset,
  chr:chr,ord:ord,pred:pred,succ:succ,toPrint:toPrint,
  flatten2:flatten2,
  log:log,isBrowser:isBrowser,
  locals:locals
};

});
