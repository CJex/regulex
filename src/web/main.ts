import {h, StyleValue} from './HTML';
import * as K from '../Kit';
import {RegexEditor} from './RegexEditor';
import './style/main.css'; // Webpack sucks!

document.addEventListener('DOMContentLoaded', main);

function main() {
  let editor = new RegexEditor();
  let editorCt = byId('editorCt');
  editor.renderTo(editorCt);

  let visualizeBtn = byId('visualizeBtn');
  visualizeBtn.onclick = () => {
    console.log(editor.getRegex());
  };
}

function byId(id: string): HTMLElement {
  return document.getElementById(id)!;
}
