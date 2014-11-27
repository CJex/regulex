if (typeof define !== 'function') var define = require('amdefine')(module);
define(function() {
function str(v) {
  return (typeof v === 'string') ? v : v.source
}

var reMatchCases=[
//[RegExp,input:String]
  [/abc/,'abc'],
  [/abc/i,'ABC'],
  [/Abc/i,'aBC'],
  [/^abc$/,'abcdef'],
  [/^Abc$/im,'def\nabc\ndef'],
  [/[a-z]{3}/,'--abc--'],
  [/[^A-H]/i,'abchijk'],
  [/[A-H]+/,'AAAA'],
  [/[A-H]+?/,'AAAA'],
  [/\w\d\s/,'A1 '],
  [/(\w|\d|\s)+/,'A1 B2\n'],
  [/[\w\d\s]+/,'A1 B2\r'],
  [/[\W\D\S]+/,'+-&*'],
  [/[^\W\D\S]+/,'+-&*'],
  [/(\d+|^a)$/,'def123'],
  [/(\d+|^a)$/,'a'],
  [/([a-z]{3}|\d+$)+/,'abc'],
  [/([a-z]{3}|\d+$)+/,'123'],
  [/^([a-zA-Z0-9])(([-.]|[_]+)?([a-zA-Z0-9]+))*(@){1}[a-z0-9]+[.]{1}(([a-z]{2,3})|([a-z]{2,3}[.]{1}[a-z]{2,3}))$/,'alan.dot@jackson.com'],
  [/\d+(?=ab)/,'123-456ab'],
  [/\d*(?=ab)/,'ab-456ab'],
  [/\d*?(?=ab)/,'ab-456ab'],
  [/https?:\/\/([a-z]+)\.(\w+)\.([a-z]+)/,'http://www.google.com'],
  [/https?:\/\/([a-z]+)\.(\w+)\.([a-z]+)/,'https://www.google.com'],
  [/^https?:\/\/([a-z]+)\.(\w+)\.([a-z]+)$/,'http://www.google.com'],
  [/^https?:\/\/([a-z]+)\.(\w+)\.([a-z]+)$/,'https://www.google.com/'],
  [/<(\w+)\s\w+="(.+?)">(.*?)<\/\1>/,'<div id="body"><span>abc</span></div>'],
  [/abc(\d+)1{2,}?\1def/,'abc12311123def'],
  [/(\w+)+\1+/,'abc123abc123!'],
  [/((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)/,
    ['127.0.0.1','255.255.255.0','192.168.11.12']
  ],
  [/\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*/,'barzar-hall@ruby-lang.com'],
  [/\d{4}-\d{1,2}-\d{1,2}/,'1990-10-1'],
  [/\b((?!abc)\w)+\b/,'babcue'],
  [/\b((?!abc)\w)+\b/,'babbcue'],
  [/^\w{1,15}(?:@(?!-))(?:(?:[a-z0-9-]*)(?:[a-z0-9](?!-))(?:\.(?!-)))+[a-z]{2,4}$/,
    [
      'abc@def.com',
      'jelly_bean@google.com.hk',
      'snow_bear@snow-bear.com.cn',
      'i@jex.im',
      'i@jex-cn.com.im',
      'i@jex-cn.bear',
      'i@123cn.bear',
      'dollar@cn.com',
      'dollar@-cn.com',
      'dollar@cn-.com',
      'snow.bear@bear.com'
    ]
  ],
  [/^(a?b)?[a-z]+X?$/,['bb','abb','bbX']],
  [
    new RegExp('http://([\\w-]+\\.)+[\\w-]+(/[\\w- ./?%&=]*)?'),
    ['http://jex.im/','http://163.com','https://github.com/JexCheng/regulex']
  ],
  [
     /^<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)$/  ,
     ['<html><body></body></html>','<p title="Head"><img /></p>']
  ]

];


var expectedPass = [
  /[^<]+|<(!(--([^-]-([^-][^-]-)->?)?|\[CDATA\[([^]]]([^]]+])]+([^]>][^]]]([^]]+])]+)>)?|DOCTYPE([ \n\t\r]+([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])([ \n\t\r]+(([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])|"[^"]"|'[^']'))([ \n\t\r]+)?(\[(<(!(--[^-]-([^-][^-]-)->|[^-]([^]"'><]+|"[^"]"|'[^']')>)|\?([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])(\?>|[\n\r\t ][^?]\?+([^>?][^?]\?+)>))|%([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F]);|[ \n\t\r]+)]([ \n\t\r]+)?)?>?)?)?|\?(([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])(\?>|[\n\r\t ][^?]\?+([^>?][^?]\?+)>)?)?|\/(([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])([ \n\t\r]+)?>?)?|(([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])([ \n\t\r]+([A-Za-z_:]|[^\x00-\x7F])([A-Za-z0-9_:.-]|[^\x00-\x7F])([ \n\t\r]+)?=([ \n\t\r]+)?("[^<"]"|'[^<']'))*([ \n\t\r]+)?\/?>?)?)/,

  'ab+(1|0)?[a-z][^0-9]',
  /[\0-\n]/,
  '/abc/',
  '[abcdefa-z\\w0-\\u540-\\u5-\\x68z-\\u5409]',
  '[abc-\\u540-\\x69]',
  "^abc+d*e+?\\?[\\n-\\rbcd]{3,110}?(?:(a|b)+|(d|[e-z]?(?!abc)))$",
  "aa+b*?c{0PP{,{10}ab+?",
  "abc(d|e)f(c(a|(?:a|b|[a-z]|a(?=def)))|b|)",
  "abc+abc",
  "abc*abc",
  "ab+\\+c*abc",
  "ab[abc]+",
  "ab[abc-d]+",
  "ab[^abc-d]*",
  "ab[^c-d]*",
  "ab[[]*",
  "ab[\\]]*",
  "ab[\\]-a]*",
  "ab[^]*",
  "ab[-]*",
  "ab[a-]*",
  "ab[-b]*",
  "ab[[]",
  "]",
  "[a-z0-1]",
  "[a-z-b]",
  "(abc(def)+(a)((a),(b),(c,(d))))",
  "([a-z]+,[abc]444,[^a-b])+,(a(t)o(a[0-1]+b,(a[0-1]+)) )",
  '[a-zA-z]+://[^\\s]*',
  '((2[0-4]\\d|25[0-5]|[01]?\\d\\d?)\\.){3}(2[0-4]\\d|25[0-5]|[01]?\\d\\d?)',
  '\\w+([-+.]\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*',
  '[a-zA-z]{}://[^\\s]*?',
  'a{1,2}{}',
  'a{1,2}{1,2,4}',
  'a{1,2}{{4}',
  'a+{1,{4}',
  'a+{1a}',
  'a+{1|3}',
  'a+{1\\}',
  'a+{\\}',
  'a+{34,45{}',
  '{}{4}{5',
  '}{4}{5',
  '{{4}{5(a|b)}',
  '{{4}{5[a-z]}',
  '{{4}{[0-9]}',
  /((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)/,
  /\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*/,
  /[1-9]\d{4,}/,
  /<(.*)(.*)>.*<\/\1>|<(.*) \/>/,
  /(?=^.{8,}$)(?=.*\d)(?=.*\W+)(?=.*[A-Z])(?=.*[a-z])(?!.*\n).*$/,
  /(\d{4}|\d{2})-((1[0-2])|(0?[1-9]))-(([12][0-9])|(3[01])|(0?[1-9]))/,
  /((1[0-2])|(0?[1-9]))\/(([12][0-9])|(3[01])|(0?[1-9]))\/(\d{4}|\d{2})/,
  /((1|0?)[0-9]|2[0-3]):([0-5][0-9])/,
  /[\u4e00-\u9fa5]/,
  /[\u3000-\u301e\ufe10-\ufe19\ufe30-\ufe44\ufe50-\ufe6b\uff01-\uffee]/,
  /(\d{4}-|\d{3}-)?(\d{8}|\d{7})/,
  /1\d{10}/,
  /[1-9]\d{5}/,
  /\d{15}(\d\d[0-9xX])?/,
  /\d+/,
  /[0-9]*[1-9][0-9]*/,
  /-[0-9]*[1-9][0-9]*/,
  /-?\d+/,
  '[a-b](a|b)+{4,5def',
  /(-?\d+)(\.\d+)?$\nabc/,
  /\b((?!abc)\w)+\b/,
  'a(?=b){4,'
].map(str);

var expectedFail = [
  'a(?=b)+','a(?=b)?','a(?=b){4}',
  '{}{4}{5}', '[a-b][z-a]{2,6}',
  '[z-\\n]',
  '[a-zA-z]+{3}',
  'abc{3,7}+',
  'a?{1,2}',
  'a+{1,2}',
  'a*{1,2}',
  'a{1}{1,2}',
  'a{1,4}{1,2}',
  "abc(def,([a-z],[0-6],([0-5]def),aaa)",
  "ab[abc",
  "abc*+abc",
  "ab++c*abc",
  "\\",
  'abc{42,13}'
].map(str);

var re2ast =[{ raw: '\\\\{3}',
  tree:
   [ { type: 'exact',
       repeat:
        { min: 3,
          max: 3,
          nonGreedy: false },
       chars: '\\',
       indices: [ 0, 5 ],
       raw: '\\\\{3}' } ],
  groupCount: 0 }
,{
  raw: 'ab+(1|0)?[a-z][^0-9]a\\nb\\rc\\td',
  groupCount: 1,
  tree: [{
    type: 'exact',
    indices: [0, 1],
    raw: 'a',
    chars: 'a'
  }, {
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    chars: 'b',
    indices: [1, 3],
    raw: 'b+'
  }, {
    type: 'group',
    num: 1,
    sub: [{
      type: 'choice',
      indices: [4, 7],
      branches: [
        [{
          type: 'exact',
          indices: [4, 5],
          raw: '1',
          chars: '1'
        }],
        [{
          type: 'exact',
          indices: [6, 7],
          raw: '0',
          chars: '0'
        }]
      ],
      raw: '1|0'
    }],
    indices: [3, 9],
    endParenIndex: 7,
    repeat: {
      min: 0,
      max: 1,
      nonGreedy: false
    },
    raw: '(1|0)?'
  }, {
    type: 'charset',
    indices: [9, 14],
    classes: [],
    ranges: ['az'],
    chars: '',
    raw: '[a-z]'
  }, {
    type: 'charset',
    indices: [14, 20],
    classes: [],
    ranges: ['09'],
    chars: '',
    exclude: true,
    raw: '[^0-9]'
  },{
    type: 'exact',
    raw:'a\\nb\\rc\\td',
    chars:'a\nb\rc\td',
    indices:[20,30]
  }]
}, {
  raw: '[\\0-\\n]',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 7],
    classes: [],
    ranges: ['\u0000\n'],
    chars: '',
    raw: '[\\0-\\n]'
  }]
}, {
  raw: '[abcdefa-z\\w0-\\u540-\\u5-\\x68z-\\u5409]',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 37],
    classes: ['w'],
    ranges: ['0u', '5h', 'az', 'z吉'],
    chars: 'abcdef54',
    raw: '[abcdefa-z\\w0-\\u540-\\u5-\\x68z-\\u5409]'
  }]
}, {
  raw: '[abc-\\u540-\\x69]',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 16],
    classes: [],
    ranges: ['0i', 'cu'],
    chars: 'ab54',
    raw: '[abc-\\u540-\\x69]'
  }]
}, {
  raw: '^abc+d*e+?\\?[\\n-\\rbcd]{3,110}?(?:(a|b)+|(d|[e-z]?(?!abc)))$',
  groupCount: 2,
  tree: [{
    type: 'assert',
    indices: [0, 1],
    assertionType: 'AssertBegin',
    raw: '^'
  }, {
    type: 'exact',
    indices: [1, 3],
    raw: 'ab',
    chars: 'ab'
  }, {
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    chars: 'c',
    indices: [3, 5],
    raw: 'c+'
  }, {
    type: 'exact',
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    chars: 'd',
    indices: [5, 7],
    raw: 'd*'
  }, {
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: true
    },
    chars: 'e',
    indices: [7, 10],
    raw: 'e+?'
  }, {
    type: 'exact',
    chars: '?',
    indices: [10, 12],
    raw: '\\?'
  }, {
    type: 'charset',
    indices: [12, 30],
    classes: [],
    ranges: ['\n\r'],
    chars: 'bcd',
    repeat: {
      min: 3,
      max: 110,
      nonGreedy: true
    },
    raw: '[\\n-\\rbcd]{3,110}?'
  }, {
    type: 'group',
    num: undefined,
    sub: [{
      type: 'choice',
      indices: [33, 57],
      branches: [
        [{
          type: 'group',
          num: 1,
          sub: [{
            type: 'choice',
            indices: [34, 37],
            branches: [
              [{
                type: 'exact',
                indices: [34, 35],
                raw: 'a',
                chars: 'a'
              }],
              [{
                type: 'exact',
                indices: [36, 37],
                raw: 'b',
                chars: 'b'
              }]
            ],
            raw: 'a|b'
          }],
          indices: [33, 39],
          endParenIndex: 37,
          repeat: {
            min: 1,
            max: Infinity,
            nonGreedy: false
          },
          raw: '(a|b)+'
        }],
        [{
          type: 'group',
          num: 2,
          sub: [{
            type: 'choice',
            indices: [41, 56],
            branches: [
              [{
                type: 'exact',
                indices: [41, 42],
                raw: 'd',
                chars: 'd'
              }],
              [{
                type: 'charset',
                indices: [43, 49],
                classes: [],
                ranges: ['ez'],
                chars: '',
                repeat: {
                  min: 0,
                  max: 1,
                  nonGreedy: false
                },
                raw: '[e-z]?'
              }, {
                type: 'assert',
                num: undefined,
                sub: [{
                  type: 'exact',
                  indices: [52, 55],
                  raw: 'abc',
                  chars: 'abc'
                }],
                indices: [49, 56],
                assertionType: 'AssertNegativeLookahead',
                endParenIndex: 55,
                raw: '(?!abc)'
              }]
            ],
            raw: 'd|[e-z]?(?!abc)'
          }],
          indices: [40, 57],
          endParenIndex: 56,
          raw: '(d|[e-z]?(?!abc))'
        }]
      ],
      raw: '(a|b)+|(d|[e-z]?(?!abc))'
    }],
    indices: [30, 58],
    nonCapture: true,
    endParenIndex: 57,
    raw: '(?:(a|b)+|(d|[e-z]?(?!abc)))'
  }, {
    type: 'assert',
    indices: [58, 59],
    assertionType: 'AssertEnd',
    raw: '$'
  }]
}, {
  raw: 'aa+b*?c{0PP{,{10}ab+?',
  groupCount: 0,
  tree: [{
    type: 'exact',
    indices: [0, 1],
    raw: 'a',
    chars: 'a'
  }, {
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    chars: 'a',
    indices: [1, 3],
    raw: 'a+'
  }, {
    type: 'exact',
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: true
    },
    chars: 'b',
    indices: [3, 6],
    raw: 'b*?'
  }, {
    type: 'exact',
    indices: [6, 12],
    raw: 'c{0PP{',
    chars: 'c{0PP{'
  }, {
    type: 'exact',
    repeat: {
      min: 10,
      max: 10,
      nonGreedy: false
    },
    chars: ',',
    indices: [12, 17],
    raw: ',{10}'
  }, {
    type: 'exact',
    indices: [17, 18],
    raw: 'a',
    chars: 'a'
  }, {
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: true
    },
    chars: 'b',
    indices: [18, 21],
    raw: 'b+?'
  }]
}, {
  raw: 'ab[\\]-a]*',
  groupCount: 0,
  tree: [{
    type: 'exact',
    indices: [0, 2],
    raw: 'ab',
    chars: 'ab'
  }, {
    type: 'charset',
    indices: [2, 9],
    classes: [],
    ranges: [']a'],
    chars: '',
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[\\]-a]*'
  }]
}, {
  raw: 'ab[^]*',
  groupCount: 0,
  tree: [{
    type: 'exact',
    indices: [0, 2],
    raw: 'ab',
    chars: 'ab'
  }, {
    type: 'charset',
    indices: [2, 6],
    classes: [],
    ranges: [],
    chars: '',
    exclude: true,
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[^]*'
  }]
}, {
  raw: 'ab[-]*',
  groupCount: 0,
  tree: [{
    type: 'exact',
    indices: [0, 2],
    raw: 'ab',
    chars: 'ab'
  }, {
    type: 'charset',
    indices: [2, 6],
    classes: [],
    ranges: [],
    chars: '-',
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[-]*'
  }]
}, {
  raw: 'ab[a-]*',
  groupCount: 0,
  tree: [{
    type: 'exact',
    indices: [0, 2],
    raw: 'ab',
    chars: 'ab'
  }, {
    type: 'charset',
    indices: [2, 7],
    classes: [],
    ranges: [],
    chars: 'a-',
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[a-]*'
  }]
}, {
  raw: '[a-z-b]',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 7],
    classes: [],
    ranges: ['az'],
    chars: '-b',
    raw: '[a-z-b]'
  }]
}, {
  raw: '(abc(def)+(a)((a),(b),(c,(d))))',
  groupCount: 8,
  tree: [{
    type: 'group',
    num: 1,
    sub: [{
      type: 'exact',
      indices: [1, 4],
      raw: 'abc',
      chars: 'abc'
    }, {
      type: 'group',
      num: 2,
      sub: [{
        type: 'exact',
        indices: [5, 8],
        raw: 'def',
        chars: 'def'
      }],
      indices: [4, 10],
      endParenIndex: 8,
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '(def)+'
    }, {
      type: 'group',
      num: 3,
      sub: [{
        type: 'exact',
        indices: [11, 12],
        raw: 'a',
        chars: 'a'
      }],
      indices: [10, 13],
      endParenIndex: 12,
      raw: '(a)'
    }, {
      type: 'group',
      num: 4,
      sub: [{
        type: 'group',
        num: 5,
        sub: [{
          type: 'exact',
          indices: [15, 16],
          raw: 'a',
          chars: 'a'
        }],
        indices: [14, 17],
        endParenIndex: 16,
        raw: '(a)'
      }, {
        type: 'exact',
        indices: [17, 18],
        raw: ',',
        chars: ','
      }, {
        type: 'group',
        num: 6,
        sub: [{
          type: 'exact',
          indices: [19, 20],
          raw: 'b',
          chars: 'b'
        }],
        indices: [18, 21],
        endParenIndex: 20,
        raw: '(b)'
      }, {
        type: 'exact',
        indices: [21, 22],
        raw: ',',
        chars: ','
      }, {
        type: 'group',
        num: 7,
        sub: [{
          type: 'exact',
          indices: [23, 25],
          raw: 'c,',
          chars: 'c,'
        }, {
          type: 'group',
          num: 8,
          sub: [{
            type: 'exact',
            indices: [26, 27],
            raw: 'd',
            chars: 'd'
          }],
          indices: [25, 28],
          endParenIndex: 27,
          raw: '(d)'
        }],
        indices: [22, 29],
        endParenIndex: 28,
        raw: '(c,(d))'
      }],
      indices: [13, 30],
      endParenIndex: 29,
      raw: '((a),(b),(c,(d)))'
    }],
    indices: [0, 31],
    endParenIndex: 30,
    raw: '(abc(def)+(a)((a),(b),(c,(d))))'
  }]
}, {
  raw: '([a-z]+,[abc]444,[^a-b])+,(a(t)o(a[0-1]+b,(a[0-1]+)) )',
  groupCount: 5,
  tree: [{
    type: 'group',
    num: 1,
    sub: [{
      type: 'charset',
      indices: [1, 7],
      classes: [],
      ranges: ['az'],
      chars: '',
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '[a-z]+'
    }, {
      type: 'exact',
      indices: [7, 8],
      raw: ',',
      chars: ','
    }, {
      type: 'charset',
      indices: [8, 13],
      classes: [],
      ranges: [],
      chars: 'abc',
      raw: '[abc]'
    }, {
      type: 'exact',
      indices: [13, 17],
      raw: '444,',
      chars: '444,'
    }, {
      type: 'charset',
      indices: [17, 23],
      classes: [],
      ranges: ['ab'],
      chars: '',
      exclude: true,
      raw: '[^a-b]'
    }],
    indices: [0, 25],
    endParenIndex: 23,
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    raw: '([a-z]+,[abc]444,[^a-b])+'
  }, {
    type: 'exact',
    indices: [25, 26],
    raw: ',',
    chars: ','
  }, {
    type: 'group',
    num: 2,
    sub: [{
      type: 'exact',
      indices: [27, 28],
      raw: 'a',
      chars: 'a'
    }, {
      type: 'group',
      num: 3,
      sub: [{
        type: 'exact',
        indices: [29, 30],
        raw: 't',
        chars: 't'
      }],
      indices: [28, 31],
      endParenIndex: 30,
      raw: '(t)'
    }, {
      type: 'exact',
      indices: [31, 32],
      raw: 'o',
      chars: 'o'
    }, {
      type: 'group',
      num: 4,
      sub: [{
        type: 'exact',
        indices: [33, 34],
        raw: 'a',
        chars: 'a'
      }, {
        type: 'charset',
        indices: [34, 40],
        classes: [],
        ranges: ['01'],
        chars: '',
        repeat: {
          min: 1,
          max: Infinity,
          nonGreedy: false
        },
        raw: '[0-1]+'
      }, {
        type: 'exact',
        indices: [40, 42],
        raw: 'b,',
        chars: 'b,'
      }, {
        type: 'group',
        num: 5,
        sub: [{
          type: 'exact',
          indices: [43, 44],
          raw: 'a',
          chars: 'a'
        }, {
          type: 'charset',
          indices: [44, 50],
          classes: [],
          ranges: ['01'],
          chars: '',
          repeat: {
            min: 1,
            max: Infinity,
            nonGreedy: false
          },
          raw: '[0-1]+'
        }],
        indices: [42, 51],
        endParenIndex: 50,
        raw: '(a[0-1]+)'
      }],
      indices: [32, 52],
      endParenIndex: 51,
      raw: '(a[0-1]+b,(a[0-1]+))'
    }, {
      type: 'exact',
      indices: [52, 53],
      raw: ' ',
      chars: ' '
    }],
    indices: [26, 54],
    endParenIndex: 53,
    raw: '(a(t)o(a[0-1]+b,(a[0-1]+)) )'
  }]
}, {
  raw: '[a-zA-z]+://[^\\s]*',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 9],
    classes: [],
    ranges: ['Az', 'az'],
    chars: '',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[a-zA-z]+'
  }, {
    type: 'exact',
    indices: [9, 12],
    raw: '://',
    chars: '://'
  }, {
    type: 'charset',
    indices: [12, 18],
    classes: ['s'],
    ranges: [],
    chars: '',
    exclude: true,
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '[^\\s]*'
  }]
}, {
  raw: '((2[0-4]\\d|25[0-5]|[01]?\\d\\d?)\\.){3}(2[0-4]\\d|25[0-5]|[01]?\\d\\d?)',
  groupCount: 3,
  tree: [{
    type: 'group',
    num: 1,
    sub: [{
      type: 'group',
      num: 2,
      sub: [{
        type: 'choice',
        indices: [2, 29],
        branches: [
          [{
            type: 'exact',
            indices: [2, 3],
            raw: '2',
            chars: '2'
          }, {
            type: 'charset',
            indices: [3, 8],
            classes: [],
            ranges: ['04'],
            chars: '',
            raw: '[0-4]'
          }, {
            type: 'charset',
            indices: [8, 10],
            chars: '',
            ranges: [],
            classes: ['d'],
            exclude: false,
            raw: '\\d'
          }],
          [{
            type: 'exact',
            indices: [11, 13],
            raw: '25',
            chars: '25'
          }, {
            type: 'charset',
            indices: [13, 18],
            classes: [],
            ranges: ['05'],
            chars: '',
            raw: '[0-5]'
          }],
          [{
            type: 'charset',
            indices: [19, 24],
            classes: [],
            ranges: [],
            chars: '01',
            repeat: {
              min: 0,
              max: 1,
              nonGreedy: false
            },
            raw: '[01]?'
          }, {
            type: 'charset',
            indices: [24, 26],
            chars: '',
            ranges: [],
            classes: ['d'],
            exclude: false,
            raw: '\\d'
          }, {
            type: 'charset',
            indices: [26, 29],
            chars: '',
            ranges: [],
            classes: ['d'],
            exclude: false,
            repeat: {
              min: 0,
              max: 1,
              nonGreedy: false
            },
            raw: '\\d?'
          }]
        ],
        raw: '2[0-4]\\d|25[0-5]|[01]?\\d\\d?'
      }],
      indices: [1, 30],
      endParenIndex: 29,
      raw: '(2[0-4]\\d|25[0-5]|[01]?\\d\\d?)'
    }, {
      type: 'exact',
      chars: '.',
      indices: [30, 32],
      raw: '\\.'
    }],
    indices: [0, 36],
    endParenIndex: 32,
    repeat: {
      min: 3,
      max: 3,
      nonGreedy: false
    },
    raw: '((2[0-4]\\d|25[0-5]|[01]?\\d\\d?)\\.){3}'
  }, {
    type: 'group',
    num: 3,
    sub: [{
      type: 'choice',
      indices: [37, 64],
      branches: [
        [{
          type: 'exact',
          indices: [37, 38],
          raw: '2',
          chars: '2'
        }, {
          type: 'charset',
          indices: [38, 43],
          classes: [],
          ranges: ['04'],
          chars: '',
          raw: '[0-4]'
        }, {
          type: 'charset',
          indices: [43, 45],
          chars: '',
          ranges: [],
          classes: ['d'],
          exclude: false,
          raw: '\\d'
        }],
        [{
          type: 'exact',
          indices: [46, 48],
          raw: '25',
          chars: '25'
        }, {
          type: 'charset',
          indices: [48, 53],
          classes: [],
          ranges: ['05'],
          chars: '',
          raw: '[0-5]'
        }],
        [{
          type: 'charset',
          indices: [54, 59],
          classes: [],
          ranges: [],
          chars: '01',
          repeat: {
            min: 0,
            max: 1,
            nonGreedy: false
          },
          raw: '[01]?'
        }, {
          type: 'charset',
          indices: [59, 61],
          chars: '',
          ranges: [],
          classes: ['d'],
          exclude: false,
          raw: '\\d'
        }, {
          type: 'charset',
          indices: [61, 64],
          chars: '',
          ranges: [],
          classes: ['d'],
          exclude: false,
          repeat: {
            min: 0,
            max: 1,
            nonGreedy: false
          },
          raw: '\\d?'
        }]
      ],
      raw: '2[0-4]\\d|25[0-5]|[01]?\\d\\d?'
    }],
    indices: [36, 65],
    endParenIndex: 64,
    raw: '(2[0-4]\\d|25[0-5]|[01]?\\d\\d?)'
  }]
}, {
  raw: '\\w+([-+.]\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*',
  groupCount: 3,
  tree: [{
    type: 'charset',
    indices: [0, 3],
    chars: '',
    ranges: [],
    classes: ['w'],
    exclude: false,
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    raw: '\\w+'
  }, {
    type: 'group',
    num: 1,
    sub: [{
      type: 'charset',
      indices: [4, 9],
      classes: [],
      ranges: [],
      chars: '-+.',
      raw: '[-+.]'
    }, {
      type: 'charset',
      indices: [9, 12],
      chars: '',
      ranges: [],
      classes: ['w'],
      exclude: false,
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '\\w+'
    }],
    indices: [3, 14],
    endParenIndex: 12,
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '([-+.]\\w+)*'
  }, {
    type: 'exact',
    indices: [14, 15],
    raw: '@',
    chars: '@'
  }, {
    type: 'charset',
    indices: [15, 18],
    chars: '',
    ranges: [],
    classes: ['w'],
    exclude: false,
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    raw: '\\w+'
  }, {
    type: 'group',
    num: 2,
    sub: [{
      type: 'charset',
      indices: [19, 23],
      classes: [],
      ranges: [],
      chars: '-.',
      raw: '[-.]'
    }, {
      type: 'charset',
      indices: [23, 26],
      chars: '',
      ranges: [],
      classes: ['w'],
      exclude: false,
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '\\w+'
    }],
    indices: [18, 28],
    endParenIndex: 26,
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '([-.]\\w+)*'
  }, {
    type: 'exact',
    chars: '.',
    indices: [28, 30],
    raw: '\\.'
  }, {
    type: 'charset',
    indices: [30, 33],
    chars: '',
    ranges: [],
    classes: ['w'],
    exclude: false,
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    raw: '\\w+'
  }, {
    type: 'group',
    num: 3,
    sub: [{
      type: 'charset',
      indices: [34, 38],
      classes: [],
      ranges: [],
      chars: '-.',
      raw: '[-.]'
    }, {
      type: 'charset',
      indices: [38, 41],
      chars: '',
      ranges: [],
      classes: ['w'],
      exclude: false,
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '\\w+'
    }],
    indices: [33, 43],
    endParenIndex: 41,
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '([-.]\\w+)*'
  }]
}, {
  raw: 'a{1,2}{}',
  groupCount: 0,
  tree: [{
    type: 'exact',
    repeat: {
      min: 1,
      max: 2,
      nonGreedy: false
    },
    chars: 'a',
    indices: [0, 6],
    raw: 'a{1,2}'
  }, {
    type: 'exact',
    indices: [6, 8],
    raw: '{}',
    chars: '{}'
  }]
}, {
  raw: 'a{1,2}{1,2,4}',
  groupCount: 0,
  tree: [{
    type: 'exact',
    repeat: {
      min: 1,
      max: 2,
      nonGreedy: false
    },
    chars: 'a',
    indices: [0, 6],
    raw: 'a{1,2}'
  }, {
    type: 'exact',
    indices: [6, 13],
    raw: '{1,2,4}',
    chars: '{1,2,4}'
  }]
}, {
  raw: 'a{1,2}{{4}',
  groupCount: 0,
  tree: [{
    type: 'exact',
    repeat: {
      min: 1,
      max: 2,
      nonGreedy: false
    },
    chars: 'a',
    indices: [0, 6],
    raw: 'a{1,2}'
  }, {
    type: 'exact',
    repeat: {
      min: 4,
      max: 4,
      nonGreedy: false
    },
    chars: '{',
    indices: [6, 10],
    raw: '{{4}'
  }]
}, {
  raw: 'a+{1,{4}',
  groupCount: 0,
  tree: [{
    type: 'exact',
    repeat: {
      min: 1,
      max: Infinity,
      nonGreedy: false
    },
    chars: 'a',
    indices: [0, 2],
    raw: 'a+'
  }, {
    type: 'exact',
    indices: [2, 4],
    raw: '{1',
    chars: '{1'
  }, {
    type: 'exact',
    repeat: {
      min: 4,
      max: 4,
      nonGreedy: false
    },
    chars: ',',
    indices: [4, 8],
    raw: ',{4}'
  }]
}, {
  raw: '<(.*)(.*)>.*<\\/\\1>|<(.*) \\/>',
  groupCount: 3,
  tree: [{
    type: 'choice',
    indices: [0, 28],
    branches: [
      [{
        type: 'exact',
        indices: [0, 1],
        raw: '<',
        chars: '<'
      }, {
        type: 'group',
        num: 1,
        sub: [{
          type: 'dot',
          indices: [2, 4],
          repeat: {
            min: 0,
            max: Infinity,
            nonGreedy: false
          },
          raw: '.*'
        }],
        indices: [1, 5],
        endParenIndex: 4,
        raw: '(.*)'
      }, {
        type: 'group',
        num: 2,
        sub: [{
          type: 'dot',
          indices: [6, 8],
          repeat: {
            min: 0,
            max: Infinity,
            nonGreedy: false
          },
          raw: '.*'
        }],
        indices: [5, 9],
        endParenIndex: 8,
        raw: '(.*)'
      }, {
        type: 'exact',
        indices: [9, 10],
        raw: '>',
        chars: '>'
      }, {
        type: 'dot',
        indices: [10, 12],
        repeat: {
          min: 0,
          max: Infinity,
          nonGreedy: false
        },
        raw: '.*'
      }, {
        type: 'exact',
        indices: [12, 13],
        raw: '<',
        chars: '<'
      }, {
        type: 'exact',
        chars: '/',
        indices: [13, 15],
        raw: '\\/'
      }, {
        type: 'backref',
        indices: [15, 17],
        num: 1,
        raw: '\\1'
      }, {
        type: 'exact',
        indices: [17, 18],
        raw: '>',
        chars: '>'
      }],
      [{
        type: 'exact',
        indices: [19, 20],
        raw: '<',
        chars: '<'
      }, {
        type: 'group',
        num: 3,
        sub: [{
          type: 'dot',
          indices: [21, 23],
          repeat: {
            min: 0,
            max: Infinity,
            nonGreedy: false
          },
          raw: '.*'
        }],
        indices: [20, 24],
        endParenIndex: 23,
        raw: '(.*)'
      }, {
        type: 'exact',
        indices: [24, 25],
        raw: ' ',
        chars: ' '
      }, {
        type: 'exact',
        chars: '/',
        indices: [25, 27],
        raw: '\\/'
      }, {
        type: 'exact',
        indices: [27, 28],
        raw: '>',
        chars: '>'
      }]
    ],
    raw: '<(.*)(.*)>.*<\\/\\1>|<(.*) \\/>'
  }]
}, {
  raw: '(?=^.{8,}$)(?=.*\\d)(?=.*\\W+)(?=.*[A-Z])(?=.*[a-z])(?!.*\\n).*$',
  groupCount: 0,
  tree: [{
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'assert',
      indices: [3, 4],
      assertionType: 'AssertBegin',
      raw: '^'
    }, {
      type: 'dot',
      indices: [4, 9],
      repeat: {
        min: 8,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.{8,}'
    }, {
      type: 'assert',
      indices: [9, 10],
      assertionType: 'AssertEnd',
      raw: '$'
    }],
    indices: [0, 11],
    assertionType: 'AssertLookahead',
    endParenIndex: 10,
    raw: '(?=^.{8,}$)'
  }, {
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'dot',
      indices: [14, 16],
      repeat: {
        min: 0,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.*'
    }, {
      type: 'charset',
      indices: [16, 18],
      chars: '',
      ranges: [],
      classes: ['d'],
      exclude: false,
      raw: '\\d'
    }],
    indices: [11, 19],
    assertionType: 'AssertLookahead',
    endParenIndex: 18,
    raw: '(?=.*\\d)'
  }, {
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'dot',
      indices: [22, 24],
      repeat: {
        min: 0,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.*'
    }, {
      type: 'charset',
      indices: [24, 27],
      chars: '',
      ranges: [],
      classes: ['W'],
      exclude: false,
      repeat: {
        min: 1,
        max: Infinity,
        nonGreedy: false
      },
      raw: '\\W+'
    }],
    indices: [19, 28],
    assertionType: 'AssertLookahead',
    endParenIndex: 27,
    raw: '(?=.*\\W+)'
  }, {
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'dot',
      indices: [31, 33],
      repeat: {
        min: 0,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.*'
    }, {
      type: 'charset',
      indices: [33, 38],
      classes: [],
      ranges: ['AZ'],
      chars: '',
      raw: '[A-Z]'
    }],
    indices: [28, 39],
    assertionType: 'AssertLookahead',
    endParenIndex: 38,
    raw: '(?=.*[A-Z])'
  }, {
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'dot',
      indices: [42, 44],
      repeat: {
        min: 0,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.*'
    }, {
      type: 'charset',
      indices: [44, 49],
      classes: [],
      ranges: ['az'],
      chars: '',
      raw: '[a-z]'
    }],
    indices: [39, 50],
    assertionType: 'AssertLookahead',
    endParenIndex: 49,
    raw: '(?=.*[a-z])'
  }, {
    type: 'assert',
    num: undefined,
    sub: [{
      type: 'dot',
      indices: [53, 55],
      repeat: {
        min: 0,
        max: Infinity,
        nonGreedy: false
      },
      raw: '.*'
    }, {
      type: 'exact',
      chars: '\n',
      indices: [55, 57],
      raw: '\\n'
    }],
    indices: [50, 58],
    assertionType: 'AssertNegativeLookahead',
    endParenIndex: 57,
    raw: '(?!.*\\n)'
  }, {
    type: 'dot',
    indices: [58, 60],
    repeat: {
      min: 0,
      max: Infinity,
      nonGreedy: false
    },
    raw: '.*'
  }, {
    type: 'assert',
    indices: [60, 61],
    assertionType: 'AssertEnd',
    raw: '$'
  }]
}, {
  raw: '(\\d{4}|\\d{2})-((1[0-2])|(0?[1-9]))-(([12][0-9])|(3[01])|(0?[1-9]))',
  groupCount: 8,
  tree: [{
    type: 'group',
    num: 1,
    sub: [{
      type: 'choice',
      indices: [1, 12],
      branches: [
        [{
          type: 'charset',
          indices: [1, 6],
          chars: '',
          ranges: [],
          classes: ['d'],
          exclude: false,
          repeat: {
            min: 4,
            max: 4,
            nonGreedy: false
          },
          raw: '\\d{4}'
        }],
        [{
          type: 'charset',
          indices: [7, 12],
          chars: '',
          ranges: [],
          classes: ['d'],
          exclude: false,
          repeat: {
            min: 2,
            max: 2,
            nonGreedy: false
          },
          raw: '\\d{2}'
        }]
      ],
      raw: '\\d{4}|\\d{2}'
    }],
    indices: [0, 13],
    endParenIndex: 12,
    raw: '(\\d{4}|\\d{2})'
  }, {
    type: 'exact',
    indices: [13, 14],
    raw: '-',
    chars: '-'
  }, {
    type: 'group',
    num: 2,
    sub: [{
      type: 'choice',
      indices: [15, 33],
      branches: [
        [{
          type: 'group',
          num: 3,
          sub: [{
            type: 'exact',
            indices: [16, 17],
            raw: '1',
            chars: '1'
          }, {
            type: 'charset',
            indices: [17, 22],
            classes: [],
            ranges: ['02'],
            chars: '',
            raw: '[0-2]'
          }],
          indices: [15, 23],
          endParenIndex: 22,
          raw: '(1[0-2])'
        }],
        [{
          type: 'group',
          num: 4,
          sub: [{
            type: 'exact',
            repeat: {
              min: 0,
              max: 1,
              nonGreedy: false
            },
            chars: '0',
            indices: [25, 27],
            raw: '0?'
          }, {
            type: 'charset',
            indices: [27, 32],
            classes: [],
            ranges: ['19'],
            chars: '',
            raw: '[1-9]'
          }],
          indices: [24, 33],
          endParenIndex: 32,
          raw: '(0?[1-9])'
        }]
      ],
      raw: '(1[0-2])|(0?[1-9])'
    }],
    indices: [14, 34],
    endParenIndex: 33,
    raw: '((1[0-2])|(0?[1-9]))'
  }, {
    type: 'exact',
    indices: [34, 35],
    raw: '-',
    chars: '-'
  }, {
    type: 'group',
    num: 5,
    sub: [{
      type: 'choice',
      indices: [36, 65],
      branches: [
        [{
          type: 'group',
          num: 6,
          sub: [{
            type: 'charset',
            indices: [37, 41],
            classes: [],
            ranges: [],
            chars: '12',
            raw: '[12]'
          }, {
            type: 'charset',
            indices: [41, 46],
            classes: [],
            ranges: ['09'],
            chars: '',
            raw: '[0-9]'
          }],
          indices: [36, 47],
          endParenIndex: 46,
          raw: '([12][0-9])'
        }],
        [{
          type: 'group',
          num: 7,
          sub: [{
            type: 'exact',
            indices: [49, 50],
            raw: '3',
            chars: '3'
          }, {
            type: 'charset',
            indices: [50, 54],
            classes: [],
            ranges: [],
            chars: '01',
            raw: '[01]'
          }],
          indices: [48, 55],
          endParenIndex: 54,
          raw: '(3[01])'
        }],
        [{
          type: 'group',
          num: 8,
          sub: [{
            type: 'exact',
            repeat: {
              min: 0,
              max: 1,
              nonGreedy: false
            },
            chars: '0',
            indices: [57, 59],
            raw: '0?'
          }, {
            type: 'charset',
            indices: [59, 64],
            classes: [],
            ranges: ['19'],
            chars: '',
            raw: '[1-9]'
          }],
          indices: [56, 65],
          endParenIndex: 64,
          raw: '(0?[1-9])'
        }]
      ],
      raw: '([12][0-9])|(3[01])|(0?[1-9])'
    }],
    indices: [35, 66],
    endParenIndex: 65,
    raw: '(([12][0-9])|(3[01])|(0?[1-9]))'
  }]
}, {
  raw: '[\\u4e00-\\u9fa5]',
  groupCount: 0,
  tree: [{
    type: 'charset',
    indices: [0, 15],
    classes: [],
    ranges: ['\u4e00\u9fa5'],
    chars: '',
    raw: '[\\u4e00-\\u9fa5]'
  }]
}];




return {
  expectedFail: expectedFail,
  expectedPass: expectedPass,
  re2ast: re2ast,
  reMatchCases:reMatchCases
};


});
