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

interface ActionsAny<P = any> {
  [key: string]: P;
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

/**
 * Function that will create a bunch of effects based on the mapping provided.
 * The key of the object are the names of the actions and the values are the generator
 * functions that should be called.
 * See examples below
 *
 * @example
 * const { fetchTicket, fetchUser } = createEffects({
 *   fetchTicket: onFetchTicket,
 *   fetchUser: onFetchUser,
 * });
 *
 * store.dispatch(fetchTicket());
 */
export function createEffects<Actions extends ActionsAny>(
  fx: {
    [key in keyof Actions]: Record<string, any> extends Actions[key] // ensures payload isn't inferred as {}
      ? () => Generator<any, any, any>
      : Actions[key] extends never
        ? () => Generator<any, any, any>
        : (payload: Actions[key]) => Generator<any, any, any>
  },
) {
  const actions: {
    [key in keyof Actions]: Record<string, any> extends Actions[key] // ensures payload isn't inferred as {}
      ? () => Action
      : Actions[key] extends never
        ? () => Action
        : (payload: Actions[key]) => Action<Actions[key]>
  } = {} as any;

  Object.keys(fx).forEach((actionType) => {
    const action = (payload?: any) => createEffect(fx[actionType], payload);
    (actions as any)[actionType] = action;
  });

  return actions;
}

const isObject = (val: any) => Object == val.constructor;

export const BATCH = '@@redux-cofx/BATCH';
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

export const BATCH_ACTIONS = '@@redux-cofx/BATCH_ACTIONS';
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
  return new Promise((resolve) => {
    const cb = (action: Action) => {
      resolve(action);
    };
    emitter.sub(actionType, cb);
  });
}

const STORE = 'STORE';
export const store = () => ({
  type: STORE,
});
const isStore = typeDetector(STORE);
function storeEffect(store: Props) {
  return Promise.resolve(store);
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
  if (isStore(effect)) return storeEffect.call(ctx, { dispatch, getState });
  return effect;
}

export function cofxMiddleware(
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
  const emitter = new EventEmitter();

  const middleware = ({ dispatch, getState }: Props) => {
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

  return { emitter, middleware };
}

export function enableBatching<S>(reducer: Reducer<S>) {
  return (state: S, action: Action) => {
    if (action.type === BATCH || action.type === BATCH_ACTIONS) {
      return action.payload.reduce(reducer, state);
    }

    return reducer(state, action);
  };
}

export default createMiddleware().middleware;
