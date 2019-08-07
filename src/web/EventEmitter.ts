import {Subtract} from 'utility-types';

export class SyntheticEvent {
  public readonly defaultPrevented: boolean = false;
  constructor(public readonly type: string) {}
  preventDefault() {
    (this as any).defaultPrevented = true;
  }

  static create<T>(type: string): SyntheticEvent;
  static create<T>(type: string, data: T): SyntheticEvent & T;
  static create<T>(type: string, data?: T): SyntheticEvent {
    let e = new SyntheticEvent(type);
    return data ? Object.assign(e, data) : e;
  }
}

export type EvtMap = {[k: string]: SyntheticEvent};
export type Events = string | EvtMap;

type UKeyOf<T> = T extends any ? Extract<keyof T, string> : never;

export type EventsMap<E extends Events> = {[K1 in Extract<E, string>]: SyntheticEvent} &
  {
    [K2 in UKeyOf<Extract<E, EvtMap>>]: E extends {[_ in K2]: SyntheticEvent} ? E[K2] : never;
  };

export type EventTypes<E extends Events> = keyof EventsMap<E>;

export type EventOfType<E extends Events, T extends EventTypes<E>> = EventsMap<E>[T];

export type EventLifeCycleHooks<E extends Events> = {[K in EventTypes<E>]?: {init: Function; clear: Function}};

export class EventEmitter<E extends Events> {
  private _eventListenerPool: {
    [K in EventTypes<E>]: Set<(e: EventOfType<E, K>) => void>;
  } = Object.create(null);

  private _eventLifeCycleHooks: EventLifeCycleHooks<E>;

  constructor(config?: {hooks?: EventLifeCycleHooks<E>}) {
    this._eventLifeCycleHooks = config && config.hooks ? config.hooks : {};
  }

  on<T extends EventTypes<E>>(eventType: T, listener: (e: EventOfType<E, T>) => void): this;
  on<T extends EventTypes<E>>(eventType: T, listener: (e: any) => void): this {
    let pool = this._eventListenerPool;
    let fnSet = pool[eventType];
    if (!fnSet) {
      fnSet = new Set();
      pool[eventType] = fnSet;
    }
    if (fnSet.size === 0) {
      let hook = this._eventLifeCycleHooks[eventType];
      if (hook) hook.init();
    }
    fnSet.add(listener);
    return this;
  }

  un<T extends EventTypes<E>>(eventType: T, listener: (e: EventOfType<E, T>) => void): this;
  un<T extends EventTypes<E>>(eventType: T, listener: (e: any) => void): this {
    let pool = this._eventListenerPool;
    let fnSet = pool[eventType];
    if (fnSet) {
      let has = fnSet.delete(listener);
      if (fnSet.size === 0 && has) {
        let hook = this._eventLifeCycleHooks[eventType];
        if (hook) hook.clear();
      }
    }
    return this;
  }

  emit<T extends UKeyOf<Extract<E, EvtMap>>>(eventType: T, data: Subtract<EventOfType<E, T>, SyntheticEvent>): boolean;
  emit<T extends Extract<E, string>>(eventType: T): boolean;
  emit<T extends EventTypes<E>>(eventType: T, data?: any): boolean {
    let pool = this._eventListenerPool;
    let fnSet = pool[eventType];
    if (!fnSet) {
      return true;
    }
    let event = SyntheticEvent.create(eventType, data);
    for (let f of fnSet) {
      f(event);
    }

    return !event.defaultPrevented;
  }

  clear<T extends EventTypes<E>>(eventType: T): this {
    delete this._eventListenerPool[eventType];
    let hook = this._eventLifeCycleHooks[eventType];
    if (hook) hook.clear();
    return this;
  }
}
