import {WritableKeys, FunctionKeys} from 'utility-types';

export const voidElementTagTuple = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
] as const;

export type VoidElementTag = typeof voidElementTagTuple[number];

export type StyleValue = {[K in WritableKeys<CSSStyleDeclaration>]?: Exclude<CSSStyleDeclaration[K], null>};

/**
Get HTML Element available attributes, not exactly correct(for example, it included outerHTML).
Exclude FunctionKeys excluded addEventListener method but retained onxxx listeners, because they are nullable
*/
type Attrs<E extends object> = {[K in Exclude<WritableKeys<E>, FunctionKeys<E>>]?: Exclude<E[K], null>} & {
  style?: StyleValue;
};

type Children = Array<HTMLElement | Text | DocumentFragment | string>;

type CreateElement<Tag, E extends object> = Tag extends VoidElementTag
  ? (attrs?: Attrs<E>) => E
  : ((...children: Children) => E) & ((attrs?: Attrs<E>, ...children: Children) => E);

export type HTMLBuilder = {[Tag in keyof HTMLElementTagNameMap]: CreateElement<Tag, HTMLElementTagNameMap[Tag]>} & {
  frag: (...children: Children) => DocumentFragment;
};

const _htmlTags =
  'a,abbr,address,applet,area,article,aside,audio,b,base,basefont,bdi,bdo,blockquote,body,br,button,canvas,caption,cite,code,col,colgroup,data,datalist,dd,del,details,dfn,dialog,dir,div,dl,dt,em,embed,fieldset,figcaption,figure,font,footer,form,frame,frameset,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,i,iframe,img,input,ins,kbd,label,legend,li,link,main,map,mark,marquee,menu,meta,meter,nav,noscript,object,ol,optgroup,option,output,p,param,picture,pre,progress,q,rp,rt,ruby,s,samp,script,section,select,slot,small,source,span,strong,style,sub,summary,sup,table,tbody,td,template,textarea,tfoot,th,thead,time,title,tr,track,u,ul,var,video,wbr';

export const htmlTags = _htmlTags.split(',') as Array<keyof HTMLElementTagNameMap>;

export const h: HTMLBuilder = {
  frag(...children: Children) {
    let a = document.createDocumentFragment();
    appends(a, children);
    return a;
  }
} as any;

htmlTags.forEach(tag => {
  (h as any)[tag] = (...args: any[]) => t(tag, ...args);
});

export function t<E extends HTMLElement>(tag: E['tagName']): E;
export function t<E extends HTMLElement>(tag: E['tagName'], a: Attrs<E>): E;
export function t<E extends HTMLElement>(tag: E['tagName'], ...a: Children): E;
export function t<E extends HTMLElement>(tag: E['tagName'], attrs: Attrs<E>, ...children: Children): E;
export function t<E extends HTMLElement>(tag: E['tagName'], attrs?: any, ...children: Children): E {
  if (attrs instanceof HTMLElement || typeof attrs === 'string') {
    children.unshift(attrs);
    attrs = undefined;
  }

  let a: any = document.createElement(tag);
  if (attrs) {
    if (attrs.style) {
      for (let p in attrs.style) {
        a.style[p] = attrs.style[p];
      }
      delete attrs.style;
    }
    for (let k in attrs) {
      a[k] = attrs[k];
    }
  }

  appends(a, children);

  return a;
}

function appends<E extends HTMLElement | DocumentFragment>(a: E, children: Children): void {
  for (let child of children) {
    if (typeof child === 'string') {
      if (child) {
        a.appendChild(document.createTextNode(child));
      }
    } else {
      a.appendChild(child);
    }
  }
}
