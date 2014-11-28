if (typeof define !== 'function') var define = require('amdefine')(module);
define(['./Kit','./parse'],function (K,parse) {
parse.exportConstants();

var FONT_SIZE=16,LABEL_FONT_SIZE=14,PATH_LEN=16,
    FONT_FAMILY='DejaVu Sans Mono,monospace';

var _multiLine=false; /* global flag quick work*/

var PAPER_MARGIN=10;

var _charSizeCache={},_tmpText;
function getCharSize(fontSize,fontBold) {
  fontBold=fontBold || 'normal';
  if (_charSizeCache[fontSize] && _charSizeCache[fontSize][fontBold])
    return _charSizeCache[fontSize][fontBold];
  _tmpText.attr({'font-size':fontSize,'font-weight':fontBold});
  var box=_tmpText.getBBox();
  _charSizeCache[fontSize]=_charSizeCache[fontSize] || {};
  return _charSizeCache[fontSize][fontBold]={
      width:box.width/((_tmpText.attr('text').length-1)/2),
      height:box.height/2
  };
}

function initTmpText(paper) {
  _tmpText=_tmpText || paper.text(-1000,-1000,"XgfTlM|.q\nXgfTlM|.q").attr('font-family',FONT_FAMILY);
}

/**
@param {AST} re AST returned by `parse`
*/
function visualize(re,flags,paper) {
  paper.clear();
  paper.setSize(0,0);
  initTmpText(paper);
  _multiLine=!!~flags.indexOf('m');

  var texts=highlight(re.tree,flags);

  texts.unshift(text('/',hlColorMap.delimiter));
  texts.unshift(text("RegExp: "));
  texts.push(text('/',hlColorMap.delimiter));
  if (flags) texts.push(text(flags,hlColorMap.flags));
  var charSize=getCharSize(FONT_SIZE,'bold'),
      startX=PAPER_MARGIN,startY=charSize.height/2+PAPER_MARGIN,
      width=0,height=0;

  width=texts.reduce(function(x,t) {
    t.x=x;
    t.y=startY;
    var w=t.text.length*charSize.width;
    return x+w;
  },startX);
  width+=PAPER_MARGIN;
  height=charSize.height+PAPER_MARGIN*2;
  texts=paper.add(texts);
  paper.setSize(width,charSize.height+PAPER_MARGIN*2);

  var ret=plot(re.tree,0,0);

  height=Math.max(ret.height+3*PAPER_MARGIN+charSize.height,height);
  width=Math.max(ret.width+2*PAPER_MARGIN,width);

  paper.setSize(width,height);
  translate(ret.items,PAPER_MARGIN,PAPER_MARGIN*2+charSize.height-ret.y);
  paper.add(ret.items);
}



function plot(tree,x,y) {
  tree.unshift({type:'startPoint'});
  tree.push({type:'endPoint'});
  return plotTree(tree,x,y);
}

function translate(items,dx,dy) {
  items.forEach(function (t) {
    if (t._translate) t._translate(dx,dy);
    t.x+=dx;t.y+=dy;
  });
}

// return NodePlot config
function plotTree(tree,x,y) {
  var results=[],items=[],
      width=0,height=0,
      fromX=x,top=y,bottom=y;
  if (!tree.length) return plotNode.empty(null,x,y);
  tree.forEach(function (node) {
    var ret;
    if (node.repeat) {
      ret=plotNode.repeat(node,fromX,y);
    } else {
      ret=plotNode[node.type](node,fromX,y);
    }
    results.push(ret);
    fromX+=ret.width+PATH_LEN;
    width+=ret.width;
    top=Math.min(top,ret.y);
    bottom=Math.max(bottom,ret.y+ret.height);
    items=items.concat(ret.items);
  });

  height=bottom-top;

  results.reduce(function (a,b) {
    width+=PATH_LEN;
    var p=hline(a.lineOutX,y,b.lineInX);
    items.push(p);
    return b;
  });
  var lineInX=results[0].lineInX,lineOutX=results[results.length-1].lineOutX;
  return {
    items:items,
    width:width,height:height,x:x,y:top,
    lineInX:lineInX,lineOutX:lineOutX
  };
}
// return NodePlot config
function textRect(s,x,y,bgColor,textColor) {
  s=K.toPrint(s);
  var padding=6;
  var charSize=getCharSize(FONT_SIZE);
  var tw=s.length*charSize.width,h=charSize.height+padding*2,w=tw+padding*2;
  var rect={
    type:'rect',
    x:x,y:y-(h/2),
    width:w,height:h,
    stroke:'none',
    fill:bgColor || 'transparent'
  };
  var t={
    type:'text',
    x:x+w/2,y:y,
    text:s,
    'font-size':FONT_SIZE,
    fill:textColor || 'black'
  };
  return {
    text:t,rect:rect,
    items:[rect,t],
    width:w,height:h,
    x:x,y:rect.y,
    lineInX:x,lineOutX:x+w
  };
}

// return LabelObject {lable:Element,x,y,width,height}
function textLabel(x,y,s,color) {// x is center x ,y is bottom y
  var charSize=getCharSize(LABEL_FONT_SIZE);
  var lines=s.split("\n");
  var textHeight=lines.length*charSize.height;
  var textWidth;
  if (lines.length>1) {
    textWidth=Math.max.apply(Math,lines.map(function (a) {return a.length}));
  } else {
    textWidth=s.length;
  }
  textWidth=textWidth*charSize.width;
  var margin=4;
  var txt={
    type:'text',
    x:x,y:y-textHeight/2-margin,
    text:s,
    'font-size':LABEL_FONT_SIZE,
    fill:color || '#444'
  };
  return {
    label:txt,
    x:x-textWidth/2,y:y-textHeight-margin,
    width:textWidth,height:textHeight+margin
  };
}
//return element config
function hline(x,y,destX) {
  return {
    type:'path',
    x:x,y:y,
    path:["M",x,y,"H",destX],
    'stroke-linecap':'butt',
    'stroke-linejoin':'round',
    'stroke':'#333',
    'stroke-width':2,
    _translate:function (x,y) {
      var p=this.path;
      p[1]+=x;p[2]+=y;p[4]+=x;
    },
  };
}

//return element config
function smoothLine(fromX,fromY,toX,toY) {
  var radius=10,p,_translate;
  var signX=fromX>toX?-1:1,signY=fromY>toY?-1:1;
  if (Math.abs(fromY-toY)<radius*1.5 /*|| Math.abs(fromX-toX)<radius*2*/) {
    p=['M',fromX,fromY,
       'C',fromX+Math.min(Math.abs(toX-fromX)/2,radius)*signX,fromY,
       toX-(toX-fromX)/2,toY,
       toX,toY];
    _translate=function (x,y) {
      var p=this.path;
      p[1]+=x;p[2]+=y;
      p[4]+=x;p[5]+=y;
      p[6]+=x;p[7]+=y;
      p[8]+=x;p[9]+=y;
    };
  } else {
    p=[
      'M',fromX,fromY,
      'Q',fromX+radius*signX,fromY,fromX+radius*signX,fromY+radius*signY,
      'V',Math.abs(fromY-toY)<radius*2 ? fromY+radius*signY : (toY-radius*signY),
      'Q',fromX+radius*signX,toY,fromX+radius*signX*2,toY,
      'H',toX
    ];
    _translate=function (x,y) {
      var p=this.path;
      p[1]+=x;p[2]+=y;
      p[4]+=x;p[5]+=y;p[6]+=x;p[7]+=y;
      p[9]+=y;
      p[11]+=x;p[12]+=y;p[13]+=x;p[14]+=y;
      p[16]+=x;
    };
  }
  return {
    type:'path',
    path:p,
    'stroke-linecap':'butt',
    'stroke-linejoin':'round',
    'stroke':'#333',
    'stroke-width':2,
    _translate:_translate
  };
}

function point(x,y,fill) {
  var r=10;
  return {
    items:[{
      type:'circle',
      fill:fill,
      cx:x+r,cy:y,r:r,
      stroke:"none",
      _translate:function (x,y) {
        this.cx+=x;
        this.cy+=y;
      }
    }],
    width:r*2,height:r*2,x:x,y:y,
    lineInX:x,lineOutX:x+r*2
  };
}

var plotNode={
  startPoint:function (node,x,y) {
    return point(x,y,"r(0.5,0.5)#EFE-green")
  },
  endPoint:function (node,x,y) {
    return point(x,y,"r(0.5,0.5)#FFF-#000")
  },
  empty:function (node,x,y) {
    var len=6;
    var l=hline(x,y,x+len);
    return {
      items:[l],
      width:len,height:2,
      x:x,y:y,lineInX:x,lineOutX:x+len
    };
  },
  exact:function (node,x,y) {
    var color='skyblue';
    return textRect(node.chars,x,y,color);
  },
  dot:function (node,x,y) {
    var bgColor='DarkGreen',textColor='white';
    var a=textRect('AnyCharExceptNewLine',x,y,bgColor,textColor);
    a.rect.r=10;
    a.rect.tip="Any char except CR LF."
    return a;
  },
  backref:function (node,x,y) {
    var bgColor='navy',textColor='white';
    var a=textRect('Backref group #'+node.num,x,y,bgColor,textColor);
    a.rect.r=8;
    return a;
  },
  repeat:function (node,x,y) {
    var padding=10,LABEL_MARGIN=4;
    var repeat=node.repeat,txt="",items=[];
    /*if (repeat.min===0 && !node._branched) {
      node._branched=true;
      return plotNode.choice({type:CHOICE_NODE,branches:[[{type:EMPTY_NODE}],[node]]},x,y);
    }*/

    var ret=plotNode[node.type](node,x,y);
    var width=ret.width,height=ret.height;

    if (repeat.min===repeat.max) {
      txt+=_plural(repeat.min);
    } else {
      txt+=repeat.min;
      if (isFinite(repeat.max)) {
        txt+= (repeat.max-repeat.min > 1 ? " to " : " or ") +_plural(repeat.max);
      } else {
        txt+=" or more times.";
      }
    }
    var offsetX=padding;
    // draw repeat rect box
    var r=padding;//radius
    var rectW=ret.width+padding*2,rectH=ret.y+ret.height+padding-y;
    width=rectW; height+=padding;
    var p={
      type:'path',
      path:['M',ret.x+padding,y,
            'Q',x,y,x,y+r,
            'V',y+rectH-r,
            'Q',x,y+rectH,x+r,y+rectH,
            'H',x+rectW-r,
            'Q',x+rectW,y+rectH,x+rectW,y+rectH-r,
            'V',y+r,
            'Q',x+rectW,y,ret.x+ret.width+padding,y
          ],
      _translate:_curveTranslate,
      stroke:'maroon',
      'stroke-width':2
    };
    if (repeat.nonGreedy) {
      txt+="(NonGreedy!)";
      p.stroke="Brown";
      p['stroke-dasharray']="-";
    }
    items.push(p);
    var skipPath;
    if (repeat.min===0) {//draw a skip path
      var skipRectH=y-ret.y+padding,skipRectW=rectW+padding*2;
      offsetX+=padding;
      width=skipRectW; height+=padding;
      skipPath={
        type:'path',
        path:['M',x,y,
              'Q',x+r,y,x+r,y-r,
              'V',y-skipRectH+r,
              'Q',x+r,y-skipRectH,x+r*2,y-skipRectH,
              'H',x+skipRectW-r*2,
              'Q',x+skipRectW-r,y-skipRectH,x+skipRectW-r,y-skipRectH+r,
              'V',y-r,
              'Q',x+skipRectW-r,y,x+skipRectW,y
            ],
        _translate:_curveTranslate,
        stroke:'#333',
        'stroke-width':2
      };
      translate([p],padding,0);
      items.push(skipPath);
    }

    var tl=textLabel(x+width/2,y,txt);
    translate([tl.label],0,rectH+tl.height+LABEL_MARGIN); //bottom  label
    items.push(tl.label);
    height+=LABEL_MARGIN+tl.height;
    var labelOffsetX=(Math.max(tl.width,width)-width)/2;
    if (labelOffsetX) translate(items,labelOffsetX,0);
    width=Math.max(tl.width,width);
    offsetX+=labelOffsetX;
    translate(ret.items,offsetX,0);
    items=items.concat(ret.items);
    return {
      items:items,
      width:width,height:height,
      x:x,y:ret.y-(skipPath?padding:0),
      lineInX:ret.lineInX+offsetX,
      lineOutX:ret.lineOutX+offsetX
    };


    function _plural(n) {
      return n+ ((n<2)? " time.":" times.");
    }
    function _curveTranslate(x,y) {
      var p=this.path;
      p[1]+=x;p[2]+=y;
      p[4]+=x;p[5]+=y;p[6]+=x;p[7]+=y;
      p[9]+=y;
      p[11]+=x;p[12]+=y;p[13]+=x;p[14]+=y;
      p[16]+=x;
      p[18]+=x;p[19]+=y;p[20]+=x;p[21]+=y;
      p[23]+=y;
      p[25]+=x;p[26]+=y;p[27]+=x;p[28]+=y;
    }
  },
  choice:function (node,x,y) {
    var marginX=20,spacing=6,paddingY=4,height=0,width=0;
    var branches=node.branches.map(function (branch) {
      var ret=plotTree(branch,x,y);
      height+=ret.height;
      width=Math.max(width,ret.width);
      return ret;
    });
    height+=(branches.length-1)*spacing+paddingY*2;
    width+=marginX*2;

    var centerX=x+width/2,dy=y-height/2+paddingY,// destY
        lineOutX=x+width,items=[];
    branches.forEach(function (a) {
      var dx=centerX-a.width/2; // destX
      translate(a.items,dx-a.x,dy-a.y);
      items=items.concat(a.items);
      /*
      var p1=smoothLine(x,y,dx-a.x+a.lineInX,y+dy-a.y);
      var p2=smoothLine(lineOutX,y,a.lineOutX+dx-a.x,y+dy-a.y);
      items=items.concat(a.items);
      items.push(p1,p2);*/
       // current a.y based on y(=0),its middle at y=0
      var lineY=y+dy-a.y;
      var p1=smoothLine(x,y,x+marginX,lineY);
      var p2=smoothLine(lineOutX,y,x+width-marginX,lineY);
      items.push(p1,p2);
      if (x+marginX!==dx-a.x+a.lineInX) {
        items.push(hline(x+marginX,lineY,dx-a.x+a.lineInX));
      }
      if (a.lineOutX+dx-a.x!==x+width-marginX) {
        items.push(hline(a.lineOutX+dx-a.x,lineY,x+width-marginX));
      }

      a.x=dx;a.y=dy;
      dy+=a.height+spacing;
    });

    return {
      items:items,
      width:width,height:height,
      x:x,y:y-height/2,
      lineInX:x,lineOutX:lineOutX
    };

  },
  charset:function (node,x,y) {
    var padding=6,spacing=4;
    var clsDesc={d:'Digit',D:'NonDigit',w:'Word',W:'NonWord',s:'WhiteSpace',S:'NonWhiteSpace'};
    var charBgColor='LightSkyBlue',charTextColor='black',
        clsBgColor='Green',clsTextColor='white',
        rangeBgColor='teal',rangeTextColor='white',
        boxColor=node.exclude?'Pink':'Khaki',
        labelColor=node.exclude?'#C00':'';
    var simple=onlyCharClass(node);
    if (simple) {
      var a=textRect(clsDesc[node.classes[0]],x,y,clsBgColor,clsTextColor);
      a.rect.r=5;
      if (!node.exclude) {
        return a;
      } else {
        var tl=textLabel(a.x+a.width/2,a.y,'None of:',labelColor);
        var items=a.items;
        items.push(tl.label);
        var oldWidth=a.width;
        var width=Math.max(tl.width,a.width);
        var offsetX=(width-oldWidth)/2;//ajust label text
        translate(items,offsetX,0);
        return {
          items:items,
          width:width,height:a.height+tl.height,
          x:Math.min(tl.x,a.x),y:tl.y,
          lineInX:offsetX+a.x,lineOutX:offsetX+a.x+a.width
        };
      }
    }
    if (!node.chars && !node.ranges.length && !node.classes.length) {
      // It must be exclude charset here
      var a= textRect('AnyChar',x,y,'green','white');
      a.rect.r=5;
      return a;
    }
    var packs=[],ret,width=0,height=0,singleBoxHeight;
    if (node.chars) {
      ret=textRect(node.chars,x,y,charBgColor,charTextColor);
      ret.rect.r=5;
      packs.push(ret);
      width=ret.width;
    }
    node.ranges.forEach(function (rg) {
      rg=rg.split('').join('-');
      var ret=textRect(rg,x,y,rangeBgColor,rangeTextColor);
      ret.rect.r=5;
      packs.push(ret);
      width=Math.max(ret.width,width);
    });
    node.classes.forEach(function (cls) {
      var ret=textRect(clsDesc[cls],x,y,clsBgColor,clsTextColor);
      ret.rect.r=5;
      packs.push(ret);
      width=Math.max(ret.width,width);
    });

    singleBoxHeight=packs[0].height;

    var pack1=[],pack2=[];
    packs.sort(function (a,b) {return b.width-a.width});
    packs.forEach(function (a) {
      if (a.width*2+spacing>width) pack1.push(a);
      else pack2.push(a); // can be inline
    });
    packs=pack1;
    var a1,a2;
    while (pack2.length) {
      a1=pack2.pop(); a2=pack2.pop();
      if (!a2) {packs.push(a1);break;}
      if (a1.width-a2.width > 2) {
        packs.push(a1);
        pack2.push(a2);
        continue;
      }
      translate(a2.items,a1.width+spacing,0);
      packs.push({
        items:a1.items.concat(a2.items),
        width:a1.width+a2.width+spacing,
        height:a1.height,
        x:a1.x,y:a1.y
      });
      height-=a1.height;
    }

    width+=padding*2;
    height=(packs.length-1)*spacing+packs.length*singleBoxHeight+padding*2;

    var rect={
      type:'rect',
      x:x,y:y-height/2,r:4,
      width:width,height:height,
      stroke:'none',fill:boxColor
    };

    var startY=rect.y+padding;
    var items=[rect];

    packs.forEach(function (a) {
      translate(a.items,x-a.x+(width-a.width)/2,startY-a.y);
      items=items.concat(a.items);
      startY+=a.height+spacing;
    });
    var tl=textLabel(rect.x+rect.width/2,rect.y,(node.exclude?'None':'One')+' of:',labelColor);
    items.push(tl.label);
    var oldWidth=width;
    width=Math.max(tl.width,width);
    var offsetX=(width-oldWidth)/2;//ajust label text
    translate(items,offsetX,0);
    return {
      items:items,
      width:width,height:height+tl.height,
      x:Math.min(tl.x,x),y:tl.y,
      lineInX:offsetX+x,lineOutX:offsetX+x+rect.width
    };
  },
  group:function (node,x,y) {
    var padding=10,lineColor='silver',strokeWidth=2;
    var sub=plotTree(node.sub,x,y);
    if (node.num) {
      translate(sub.items,padding,0);
      var rectW=sub.width+padding*2,rectH=sub.height+padding*2;
      var rect={
        type:'rect',
        x:x,y:sub.y-padding,r:6,
        width:rectW,height:rectH,
        'stroke-dasharray':".",
        stroke:lineColor,
        'stroke-width':strokeWidth
      };
      var tl=textLabel(rect.x+rect.width/2,rect.y-strokeWidth,'Group #'+node.num);
      var items=sub.items.concat([rect,tl.label]);
      var width=Math.max(tl.width,rectW);
      var offsetX=(width-rectW)/2;//ajust label text space
      if (offsetX) translate(items,offsetX,0);
      return {
        items:items,
        width:width,
        height:rectH+tl.height,
        x:x,y:tl.y,
        lineInX:offsetX+sub.lineInX+padding,lineOutX:offsetX+sub.lineOutX+padding
      };
    }
    return sub;
  },
  assert:function (node,x,y) {
    var simpleAssert={
      AssertNonWordBoundary:{bg:"maroon",fg:"white"},
      AssertWordBoundary:{bg:"purple",fg:"white"},
      AssertEnd:{bg:"Indigo",fg:"white"},
      AssertBegin:{bg:"Indigo",fg:"white"}
    };
    var conf,nat=node.assertionType,txt=nat.replace('Assert','')+'!';
    if (conf=simpleAssert[nat]) {
      if (_multiLine && (nat==='AssertBegin' || nat==='AssertEnd'))  {
        txt='Line'+txt;
      }
      return textRect(txt,x,y,conf.bg,conf.fg);
    }

    var lineColor,fg,padding=8;
    if (nat===AssertLookahead) {
      lineColor="CornflowerBlue";
      fg="darkgreen";
      txt="If followed by:";
    } else if (nat===AssertNegativeLookahead) {
      lineColor="#F63";
      fg="Purple";
      //txt="Negative\nLookahead!"; // break line
      txt="If not followed by:";
    }

    var sub=plotNode.group(node,x,y);
    var rectH=sub.height+padding*2,rectW=sub.width+padding*2;
    var rect={
      type:'rect',
      x:x,y:sub.y-padding,r:6,
      width:rectW,height:rectH,
      'stroke-dasharray':"-",
      stroke:lineColor,
      'stroke-width':2
    };

    var tl=textLabel(rect.x+rectW/2,rect.y,txt,fg);
    var width=Math.max(rectW,tl.width);
    var offsetX=(width-rectW)/2;//ajust label text
    translate(sub.items,offsetX+padding,0);

    if (offsetX) translate([rect,tl.label],offsetX,0);
    var items=sub.items.concat([rect,tl.label]);
    return {
      items:items,
      width:width,
      height:rect.height+tl.height,
      x:x,y:tl.y,
      lineInX:offsetX+sub.lineInX+padding,lineOutX:offsetX+sub.lineOutX+padding
    };
  }
};



var hlColorMap={
  delimiter:'Indigo',
  flags:'darkgreen',
  exact:'#334',
  dot:'darkblue',
  backref:'teal',
  '$':'purple',
  '^':'purple',
  '\\b':'#F30',
  '\\B':'#F30',
  '(':'blue',
  ')':'blue',
  '?=':'darkgreen',
  '?!':'red',
  '?:':'grey',
  '[':'navy',
  ']':'navy',
  '|':'blue',
  '{':'maroon',
  ',':'maroon',
  '}':'maroon',
  '*':'maroon',
  '+':'maroon',
  '?':'maroon',
  repeatNonGreedy:'#F61',
  defaults:'black',
  charsetRange:'olive',
  charsetClass:'navy',
  charsetExclude:'red',
  charsetChars:'#534'
};


/**
@param {AST.tree} re AST.tree return by `parse`
*/
function highlight(tree,flags) {
  var texts=[];
  tree.forEach(function (node) {
    if (node.sub) {
      texts.push(text('('));
      if (node.type===ASSERT_NODE) {
        if (node.assertionType===AssertLookahead) {
          texts.push(text('?='));
        } else  {
          texts.push(text('?!'));
        }
      } else if (node.nonCapture) {
        texts.push(text('?:'));
      }
      texts=texts.concat(highlight(node.sub));
      texts.push(text(')'));
    } else if (node.branches) {
      node.branches.map(highlight).forEach(function (ts) {
        texts=texts.concat(ts);
        texts.push(text('|'));
      });
      texts.pop();
    } else {
      var color=hlColorMap[node.type] || hlColorMap.defaults;
      switch (node.type) {
        case CHARSET_NODE:
          var simple=onlyCharClass(node);
          (!simple || node.exclude) && texts.push(text('['));
          if (node.exclude) texts.push(text('^',hlColorMap.charsetExclude));
          node.ranges.forEach(function (rg) {
            texts.push(text(_charsetEscape(rg[0]+'-'+rg[1]),hlColorMap.charsetRange));
          });
          node.classes.forEach(function (cls) {
            texts.push(text("\\"+cls,hlColorMap.charsetClass));
          });
          texts.push(text(_charsetEscape(node.chars),hlColorMap.charsetChars));
          (!simple || node.exclude) && texts.push(text(']'));
          break;
        default:
          var s=node.raw || '';
          if (node.repeat) s=s.slice(0,node.repeat.beginIndex);
          s=K.toPrint(s,true);
          texts.push(text(s,color));
      }
    }
    if (node.repeat) {
      var min=node.repeat.min,max=node.repeat.max;
      if (min===0 && max===Infinity) texts.push(text('*'));
      else if (min===1 && max===Infinity) texts.push(text('+'));
      else if (min===0 && max===1) texts.push(text('?'));
      else {
        texts.push(text('{'));
        texts.push(text(min));
        if (min===max) texts.push(text('}'));
        else {
          texts.push(text(','));
          if (isFinite(max)) texts.push(text(max));
          texts.push(text('}'));
        }
      }
      if (node.repeat.nonGreedy) {
        texts.push(text('?',hlColorMap.repeatNonGreedy));
      }
    }
  });
  return texts;
}

function _charsetEscape(s) {
  s=K.toPrint(s);
  return s.replace(/\[/g,'\\[').replace(/\]/g,'\\]');
}

function text(s,color) {
  color = color || hlColorMap[s] || hlColorMap.defaults;
  return {
    type:'text',
    'font-size':FONT_SIZE,'font-family':FONT_FAMILY,
    text:s+"",fill:color,'text-anchor':'start','font-weight':'bold'
  };
}

function onlyCharClass(node) {
  return !node.chars && !node.ranges.length && node.classes.length===1;
}

return visualize;

});
