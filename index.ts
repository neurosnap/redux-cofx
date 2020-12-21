import {
  factory,
  call,
  fork,
  spawn,
  all,
  race,
  delay,
  Effect,
  NextFn,
  typeDetector,
} from 'cofx';

export { call, fork, spawn, delay, all, race };

interface Action<P = any> {
  type: string;
  payload?: P;
  error?: boolean;
  meta?: any;
}

interface Dispatch {
  <T extends Action>(action: T): T;
}

type Reducer<S> = (state: S, action: Action) => S;
type Fn = (...args: any[]) => void;
type GetState = () => void;

interface EffectObj {
  fn: Fn;
  args?: any[];
  cancel?: Promise<any>;
}

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
  payload: { fn: Fn; args?: any[]; cancel?: Promise<any> };
}

export const createEffect = (
  val: Fn | EffectObj,
  ...args: any[]
): CreateEffect => {
  if (isObject(val)) {
    const obj = val as EffectObj;
    return {
      type: EFFECT,
      payload: { ...obj },
    };
  }

  const fn = val as Fn;
  return {
    type: EFFECT,
    payload: { fn, args },
  };
};

interface EffectMap {
  [key: string]: Fn;
}
type EffectAction = (payload?: any) => CreateEffect;
export interface EffectActionMap {
  [key: string]: EffectAction;
}

export const createEffects = (effectMap: EffectMap): EffectActionMap => {
  return Object.keys(effectMap).reduce((acc: EffectActionMap, name: string) => {
    acc[name] = (payload?: any) => createEffect(effectMap[name], payload);
    return acc;
  }, {});
};

const isObject = (val: any) => Object == val.constructor;

const BATCH = '@@redux-cofx/BATCH';
export const batch = (actions: Action[]) => ({
  type: BATCH,
  actions,
});
const isBatch = typeDetector(BATCH);
function batchEffect({ actions }: { actions: Action[] }, dispatch: Dispatch) {
  const normalActions = actions.filter(
    (action) => !action || action.type !== EFFECT,
  );
  dispatch({
    type: BATCH,
    payload: normalActions,
  });

  const effectActions = actions.filter(
    (action) => action && action.type === EFFECT,
  );
  effectActions.forEach((action) => {
    dispatch(action);
  });
  return Promise.resolve();
}

const BATCH_ACTIONS = '@@redux-cofx/BATCH_ACTIONS';
export const batchActions = (payload: Action[]) => ({
  type: BATCH_ACTIONS,
  payload,
});

const PUT = 'PUT';
export const put = (action: Action) => ({ type: PUT, action });
const isPut = typeDetector(PUT);
function putEffect({ action }: { action: Action }, dispatch: Dispatch) {
  dispatch(action);
  return Promise.resolve();
}

export type Tail<L extends any[]> = ((...l: L) => any) extends ((
  h: any,
  ...t: infer T
) => any)
  ? T
  : never;

const SELECT = 'SELECT';
export function select<Fn extends (...args: any[]) => any>(
  fn: Fn,
  ...args: Tail<Parameters<Fn>>
) {
  return {
    type: SELECT,
    fn,
    args,
  };
}
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
  if (isBatch(effect)) return batchEffect.call(ctx, effect, dispatch);
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

      const { fn, args = [], cancel } = (<CreateEffect>action).payload;
      return task({ fn, args: [...args, extraArg], cancel }).catch(
        (err: any) => {
          dispatch(error(err));
          throw err;
        },
      );
    };
  };
}

export function enableBatching<S>(reducer: Reducer<S>) {
  return (state: S, action: Action) => {
    if (action.type === BATCH || action.type === BATCH_ACTIONS) {
      return action.payload.reduce(reducer, state);
    }

    return reducer(state, action);
  };
}

export default createMiddleware();
