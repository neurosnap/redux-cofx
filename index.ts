import { factory, call, spawn, all, delay, Effect, NextFn  } from 'cosed';

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

export type ERROR = '@@redux-cosed/ERROR';
const error = (payload: any) => ({
  type: '@@redux-cosed/ERROR',
  payload,
});

export const EFFECT = '@@redux-cosed/EFFECT';
export interface CreateEffect {
  type: '@@redux-cosed/EFFECT';
  payload: { fn: Fn; args: any[] };
}

export const createEffect = (fn: Fn, ...args: any[]): CreateEffect => ({
  type: EFFECT,
  payload: { fn, args },
});

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

function effectHandler(effect: Effect, dispatch: Dispatch, getState: GetState) {
  const ctx = this;
  if (isPut(effect)) return putEffect.call(ctx, effect, dispatch);
  if (isSelect(effect)) return selectEffect.call(ctx, effect, getState);
  return effect;
}

function cosedMiddleware(dispatch: Dispatch, getState: GetState) {
  return (next: NextFn) => {
    return (effect: Effect) => {
      const nextEffect = effectHandler(effect, dispatch, getState);
      return next(nextEffect);
    };
  };
}

function createMiddleware() {
  return ({ dispatch, getState }: Props) => {
    const cosed = cosedMiddleware(dispatch, getState);
    const task = factory(cosed);

    return (next: Dispatch) => (action: Action) => {
      if (!action || action.type !== EFFECT) {
        return next(action);
      }

      const { fn, args } = (<CreateEffect>action).payload;
      return task(fn, ...args).catch((err: any) => {
        dispatch(error(err));
        throw err;
      });
    };
  };
}

export default createMiddleware();
