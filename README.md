Regulex
=======

JavaScript Regular Expression Parser & Visualizer.

Online : http://jex.im/regulex/

###Features:
- Written in pure JavaScript. No backend needed.
- You can embed the graph in you own site through html iframe element.
- Detailed error message. In most cases it can point out the precise syntax error position.
- No support for octal escape. Yes it is a feature. ECMAScript strict mode doesn't support octal escape in string,but many browsers still support octal escape in regex. I make things easier. In regulex,  DecimalEscape will always be treated as back reference. If the back reference is invalid, e.g. `/\1/`、`/(\1)/`、`/(a)\2/`,or DecimalEscape appears in charset（because in this case it can't be explained as back reference, e.g. `/(ab)[\1]/`）, Regulex will always throw an error.

### Build

This command will generate `dest/regulex.js` file.
```bash
npm install requirejs -g
r.js -o build-config.js
```


### API

#### Parse to AST
```javascript
var parse = require('regulex').parse;
var re = /var\s+([a-zA-Z_]\w*);/ ;
console.log(parse(re.source));
```

#### Visualize
```javascript
var parse = require('regulex').parse;
var visualize = require('regulex').visualize;
var Raphael = require('regulex').Raphael;
var re = /var\s+([a-zA-Z_]\w*);/;
var paper = Raphael('yourSvgContainer',0,0);
try {
  visualize(parse(re.source),getRegexFlags(re),paper);
} catch(e) {
  if (e instanceof parse.RegexSyntaxError) {
    logError(re,e);
  } else throw e;
}

function logError(re,err) {
  var msg=["Error:"+err.message,""];
  if (typeof err.lastIndex==='number') {
    msg.push(re);
    msg.push(new Array(err.lastIndex).join('-')+"^");
  }
  console.log(msg.join("\n"));
}


function getRegexFlags(re) {
  var flags='';
  flags+=re.ignoreCase?'i':'';
  flags+=re.global?'g':'';
  flags+=re.multiline?'m':'';
  return flags;
}
```
