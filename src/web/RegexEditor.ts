import {h} from './HTML';
import {EventEmitter, SyntheticEvent, EventsMap} from './EventEmitter';
import {TextEditor, LEFT_ARROW_KEYCODE} from './TextEditor';
import * as css from './style/RegexEditor.local.css';
import * as AST from '../AST';
import * as K from '../Kit';
import {RegexError} from '../grammar/Base';
import * as JSRE from '../grammar/JSRE';

export type RegexValidateError = RegexError | {type: 'Flags'; invalid: string};

export type RegexEditorEvents = {change: SyntheticEvent & {resultRegex: K.Result<AST.Regex, RegexValidateError>}};

export interface RegexEditorConfig {
  source: string;
  instantValidate: boolean;
  syntax: 'JSRE' | 'PCRE';
}

export class RegexEditor extends EventEmitter<RegexEditorEvents> {
  static readonly defaultConfig: RegexEditorConfig = {
    source: '',
    instantValidate: true,
    syntax: 'JSRE'
  };

  private readonly _sourceEditor = new TextEditor();
  private readonly _flagsInput = h.input({className: css.flagsInput, value: 'u', maxLength: 8});

  public readonly ele = h.div(
    {className: css.editorCt},
    h.div({className: css.slash}),
    this._sourceEditor.ele,
    h.div({className: css.endSlash + ' ' + css.slash}),
    h.div({className: css.flagsInputCt}, this._flagsInput)
  );

  public readonly config: RegexEditorConfig;
  constructor(config?: Partial<RegexEditorConfig>) {
    super({
      hooks: {
        change: {
          init: () => {
            sourceEditor.on('change', _onChange);
            this._flagsInput.addEventListener('input', _onChange);
          },
          clear: () => {
            sourceEditor.un('change', _onChange);
            this._flagsInput.removeEventListener('input', _onChange);
          }
        }
      }
    });

    this.config = Object.assign({}, RegexEditor.defaultConfig, config || {});

    const _onChange = this._onChange.bind(this);
    let sourceEditor = this._sourceEditor;
    sourceEditor.ele.classList.add(css.sourceEditor);
    sourceEditor.setTextContent(this.config.source);

    sourceEditor.ele.addEventListener('paste', event => {
      event.preventDefault();
      let data = event.clipboardData!;
      let re = data.getData('text').trim();
      let flagsPattern = /\/([imgsuyx]*)$/u;
      if (re.startsWith('/') && flagsPattern.test(re)) {
        // Paste RegExp literal
        let flags = flagsPattern.exec(re)![1];
        if (flags) {
          this._flagsInput.value = flags;
        }
        re = re.slice(1, re.lastIndexOf('/'));
        sourceEditor.setTextContent(re);
      } else {
        sourceEditor.insertAt(re, 'Caret');
      }
    });

    sourceEditor.on('boundary', event => {
      if (event.boundary === 'End') {
        this._flagsInput.focus();
        this._flagsInput.selectionEnd = 0;
      }
    });
  }

  public renderTo(container: HTMLElement) {
    container.appendChild(this.ele);
    this._afterRender();
  }

  private _afterRender() {
    this._initFlagsInput();
  }

  public getRegex(): K.Result<AST.Regex, RegexValidateError> {
    let {source, flags} = this.getRawText();
    let flagsResult = AST.RegexFlags.parse(flags, true);
    if (!K.isResultOK(flagsResult)) {
      return K.Err({type: 'Flags', invalid: flagsResult.error});
    }

    let regexFlags = flagsResult.value;

    let regexResult = JSRE.parse(source, regexFlags);
    return regexResult;
  }

  public getRawText(): {source: string; flags: string} {
    return {
      source: this._sourceEditor.getTextContent(),
      flags: this._flagsInput.value
    };
  }

  private _initFlagsInput() {
    let input = this._flagsInput;
    let maxWidth = parseInt(getComputedStyle(input).maxWidth!);
    let charWidth = Math.ceil(maxWidth / input.maxLength);

    resizeInput();
    input.addEventListener('input', resizeInput);

    input.addEventListener('keydown', event => {
      if (event.keyCode === LEFT_ARROW_KEYCODE && input.selectionEnd === 0) {
        this._sourceEditor.focus('End');
        event.preventDefault();
      }
    });

    function resizeInput() {
      let w = (input.value.length + 1) * charWidth;
      w = w > maxWidth ? maxWidth : w;
      input.style.width = w + 'px';
    }
  }

  private _onChange(event: SyntheticEvent) {
    let resultRegex = this.getRegex();
    let evt = event as EventsMap<RegexEditorEvents>['change'];
    evt.resultRegex = resultRegex;

    this.emit('change', evt);
  }
}
