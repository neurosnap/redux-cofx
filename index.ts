import { factory, call, spawn, all, delay, Effect, NextFn } from 'cofx';

export { call, spawn, delay, all };

interface Action {
  type: string;
  [key: string]: any;
}
interface Dispatch {
  <T extends Action>(action: T): T;
}
type Fn = (...args: any[]) => void;
type GetState = () => void;

interface Props {
  dispatch: Dispatch;
  getState: GetState;
}

export type ERROR = '@@redux-cofx/ERROR';
const error = (payload: any) => ({
  type: '@@redux-cofx/ERROR',
  payload,
});

export const EFFECT = '@@redux-cofx/EFFECT';
export interface CreateEffect {
  type: '@@redux-cofx/EFFECT';
  payload: { fn: Fn; args: any[] };
}

export const createEffect = (fn: Fn, ...args: any[]): CreateEffect => ({
  type: EFFECT,
  payload: { fn, args },
});

interface EffectMap {
  [key: string]: Fn;
}
type EffectAction = (payload: any) => CreateEffect;
export interface EffectActionMap {
  [key: string]: EffectAction;
}

export const createEffects = (effectMap: EffectMap): EffectActionMap => {
  return Object.keys(effectMap).reduce((acc: EffectActionMap, name: string) => {
    acc[name] = (payload: any) => createEffect(effectMap[name], payload);
    return acc;
  }, {});
};

const isObject = (val: any) => Object == val.constructor;
const typeDetector = (type: string) => (value: any) =>
  value && isObject(value) && value.type === type;

const PUT = 'PUT';
export const put = (action: Action) => ({ type: PUT, action });
const isPut = typeDetector(PUT);
function putEffect({ action }: { action: Action }, dispatch: Dispatch) {
  dispatch(action);
  return Promise.resolve();
}

const SELECT = 'SELECT';
export const select = (fn: Fn, ...args: any[]) => ({
  type: SELECT,
  fn,
  args,
});
const isSelect = typeDetector(SELECT);
function selectEffect(
  { fn, args }: { fn: Fn; args: any[] },
  getState: GetState,
) {
  const state = getState();
  const result = fn(state, ...args);
  return Promise.resolve(result);
}

const TAKE = 'TAKE';
export const take = (actionType: string) => ({
  type: TAKE,
  actionType,
});
const isTake = typeDetector(TAKE);
function takeEffect(
  { actionType }: { actionType: string },
  emitter: EventEmitter,
) {
  return new Promise((resolve, reject) => {
    const cb = (action: Action) => {
      resolve(action);
    };
    emitter.sub(actionType, cb);
  });
}

function effectHandler(
  effect: Effect,
  dispatch: Dispatch,
  getState: GetState,
  emitter: EventEmitter,
) {
  const ctx = this;
  if (isPut(effect)) return putEffect.call(ctx, effect, dispatch);
  if (isSelect(effect)) return selectEffect.call(ctx, effect, getState);
  if (isTake(effect)) return takeEffect.call(ctx, effect, emitter);
  return effect;
}

function cofxMiddleware(
  dispatch: Dispatch,
  getState: GetState,
  emitter: EventEmitter,
) {
  return (next: NextFn) => (effect: Effect) => {
    const nextEffect = effectHandler(effect, dispatch, getState, emitter);
    return next(nextEffect);
  };
}

interface Events {
  [key: string]: Fn[];
}

class EventEmitter {
  listeners: Events = {};

  constructor() {}

  sub(actionType: string, fn: Fn) {
    if (!this.has(actionType)) {
      this.listeners[actionType] = [];
    }

    this.listeners[actionType].push(fn);
  }

  unsubType(actionType: string) {
    if (!this.has(actionType)) {
      return;
    }
    this.listeners[actionType] = [];
  }

  emit(actionType: string, data: any) {
    if (!this.has(actionType)) {
      return;
    }

    this.listeners[actionType].forEach((cb) => cb(data));
    this.unsubType(actionType);
  }

  has(actionType: string) {
    return this.listeners.hasOwnProperty(actionType);
  }
}

export function createMiddleware(extraArg?: any) {
  return ({ dispatch, getState }: Props) => {
    const emitter = new EventEmitter();
    const cofx = cofxMiddleware(dispatch, getState, emitter);
    const task = factory(cofx);

    return (next?: Dispatch) => (action?: Action) => {
      if (action && action.type && emitter.has(action.type)) {
        emitter.emit(action.type, action);
      }

      if (!action || action.type !== EFFECT) {
        return next(action);
      }

      const { fn, args } = (<CreateEffect>action).payload;
      return task(fn, ...args, extraArg).catch((err: any) => {
        dispatch(error(err));
        throw err;
      });
    };
  };
}

export default createMiddleware();
