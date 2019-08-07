import {h} from './HTML';
import {EventEmitter, SyntheticEvent} from './EventEmitter';

export const LEFT_ARROW_KEYCODE = 37;
export const RIGHT_ARROW_KEYCODE = 39;
export const ENTER_KEYCODE = 13;

export type TextEditorEvents = 'change' | {boundary: SyntheticEvent & {readonly boundary: 'End' | 'Start'}};

export interface TextEditorConfig {
  multiline: boolean;
  // Check text content change delay in milliseconds
  checkChangeDelay: number;
}

export class TextEditor extends EventEmitter<TextEditorEvents> {
  static readonly defaultConfig: TextEditorConfig = {
    multiline: false,
    checkChangeDelay: 500
  };
  public readonly ele = h.div({contentEditable: 'true', spellcheck: false});
  public readonly config: TextEditorConfig;
  constructor(config?: Partial<TextEditorConfig>) {
    super({
      hooks: {
        change: {
          init: () => this.ele.addEventListener('input', _checkChangeEvent),
          clear: () => {
            this.ele.removeEventListener('input', _checkChangeEvent);
            clearTimeout(this._checkChangeDelayTask);
          }
        },
        boundary: {
          init: () => this.ele.addEventListener('keydown', _checkCaretBoundaryEvent),
          clear: () => this.ele.removeEventListener('keydown', _checkCaretBoundaryEvent)
        }
      }
    });

    this.config = Object.assign({}, TextEditor.defaultConfig, config || {});

    const _checkChangeEvent = this._checkChangeEvent.bind(this);

    const _checkCaretBoundaryEvent = (event: KeyboardEvent) => {
      let keyCode = event.keyCode;
      if (keyCode === LEFT_ARROW_KEYCODE || keyCode === RIGHT_ARROW_KEYCODE) {
        if (String(getSelection())) return;
        let b = keyCode === LEFT_ARROW_KEYCODE ? ('Start' as const) : ('End' as const);
        if (this.isCaretAtBoundary(b)) {
          this.emit('boundary', {boundary: b});
          event.preventDefault();
        }
      }
    };

    if (!this.config.multiline) {
      this.ele.addEventListener('keydown', event => {
        if (event.keyCode === ENTER_KEYCODE) {
          event.preventDefault();
        }
      });
    }
  }

  focus(position: 'Start' | 'End' = 'End') {
    this.ele.focus();
    let sel = getSelection()!;
    if (position === 'End') {
      let {lastChild} = this.ele;
      if (lastChild) {
        let range = sel.getRangeAt(0);
        range.setEndAfter(lastChild);
        range.collapse(false);
      }
    }
  }

  insertAt(content: string | Node, position: 'Start' | 'End' | 'Caret') {
    if (position === 'Start') {
      this.ele.prepend(content);
    } else if (position === 'End') {
      this.ele.append(content);
    } else {
      let sel = getSelection()!;
      let anchorNode = sel.anchorNode!;
      if (!this.ele.contains(anchorNode)) {
        this.ele.append(content);
        return;
      }

      if (position === 'Caret') {
        if (typeof content === 'string') {
          // preserve undo history
          document.execCommand('insertText', false, content);
        } else {
          let range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(content);
        }
        sel.collapseToEnd();
      } else {
        // TODO: Support number text offset position?
      }
    }
  }

  getTextContent(): string {
    return this.ele.textContent || '';
  }

  _prevTextContent: string = '';
  setTextContent(s: string) {
    this.ele.textContent = s;
    this._prevTextContent = s;
  }

  isCaretAtBoundary(boundary: 'Start' | 'End'): boolean {
    let sel = getSelection()!;
    let focusNode = sel.focusNode!;
    let offset = sel.focusOffset;
    if (focusNode === this.ele) {
      if (!this.ele.textContent) return true;
      return offset === (boundary === 'Start' ? 0 : 1);
    }
    if (!this.ele.contains(focusNode)) return boundary === 'End';
    if (boundary === 'Start' && offset !== 0) return false;

    let boundaryNode: Node | null = this.ele;
    while (boundaryNode) {
      if (boundary === 'Start') {
        if (focusNode === boundaryNode) return true;
        boundaryNode = boundaryNode.firstChild;
      } else if (boundary === 'End') {
        if (focusNode === boundaryNode) return offset === (boundaryNode.nodeValue || '').length;
        boundaryNode = boundaryNode.lastChild;
      }
    }
    return false;
  }

  private _checkChangeDelayTask = -1;
  private _checkChangeEvent() {
    clearTimeout(this._checkChangeDelayTask);
    this._checkChangeDelayTask = setTimeout(() => {
      let txt = this.ele.textContent || '';
      if (txt !== this._prevTextContent) {
        this._prevTextContent = txt;
        this.emit('change');
      }
    }, this.config.checkChangeDelay) as any;
  }
}
