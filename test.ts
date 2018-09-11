import * as test from 'tape';
import { createStore, applyMiddleware } from 'redux';

import cofxMiddleware, {
  createEffect,
  take,
  createEffects,
  put,
} from './index';

test('createMiddleware', (t) => {
  const doDispatch: any = () => {};
  const doGetState = () => {};
  const nextHandler = cofxMiddleware({
    dispatch: doDispatch,
    getState: doGetState,
  });

  t.plan(8);

  t.equal(
    typeof nextHandler,
    'function',
    'must return a function to handle next',
  );
  t.equal(nextHandler.length, 1);

  let actionHandler = nextHandler();
  t.equal(
    typeof actionHandler,
    'function',
    'must return a function to handle action',
  );
  t.equal(actionHandler.length, 1);

  actionHandler = nextHandler();
  const expectedProps = { ok: true };
  const fn = (props: any) => {
    t.pass('must activate function');
    t.deepEqual(props, expectedProps, 'must have correct props');
  };
  actionHandler(createEffect(fn, expectedProps));

  const actionObj = { type: '' };
  const act: any = (action: any) => {
    t.deepEqual(
      action,
      actionObj,
      'must pass action to next if not a function',
    );
  };
  actionHandler = nextHandler(act);
  actionHandler(actionObj);

  const expected = 'redux';
  const another: any = () => expected;
  actionHandler = nextHandler(another);
  const outcome = actionHandler();
  t.deepEqual(
    outcome,
    expected,
    'must return the return value of next if not a function',
  );
});

test('action promise error', (t) => {
  t.plan(1);

  const doDispatch: any = (actual: any) => {
    const expected = {
      type: '@@redux-cofx/ERROR',
      payload: 'some error',
    };
    t.deepEqual(
      actual,
      expected,
      'must dispatch an error with correct message',
    );
  };
  const doGetState = () => {};
  const nextHandler = cofxMiddleware({
    dispatch: doDispatch,
    getState: doGetState,
  });

  const actionHandler = nextHandler();
  const prom = () => Promise.reject('some error');
  actionHandler(createEffect(prom));
});

test('createEffect action', (t) => {
  t.plan(1);

  const prom = () => {};
  const expected = {
    type: '@@redux-cofx/EFFECT',
    payload: { fn: prom, args: ['one', 'two'] },
  };
  const actual = createEffect(prom, 'one', 'two');
  t.deepEqual(actual, expected);
});

test('take effect', (t: test.Test) => {
  t.plan(1);

  const actionResult = { type: 'SOMETHING', payload: 'nice' };

  function* effect() {
    const action = yield take('SOMETHING');
    t.deepEqual(action, actionResult);
  }

  const store = createStore(
    (state: any) => state,
    applyMiddleware(cofxMiddleware),
  );
  const doIt = () => createEffect(effect);
  store.dispatch(doIt());
  store.dispatch({ type: 'ANOTHER' });
  store.dispatch(actionResult);
});

test('create effects', (t: test.Test) => {
  t.plan(1);

  function* effOne(payload: any) {
    yield put({ type: 'AWESOME', payload });
  }

  function* effTwo(payload: any) {
    yield put({ type: 'WOW', payload });
  }

  const effects = createEffects({
    one: effOne,
    two: effTwo,
  });

  const reducer = (state: any, action: any) => {
    if (action.type === 'AWESOME') {
      return { ...state, awesome: action.payload };
    }

    if (action.type === 'WOW') {
      return { ...state, wow: action.payload };
    }

    return state;
  };
  const store = createStore(reducer, applyMiddleware(cofxMiddleware));

  store.dispatch(effects.one('ok'));
  store.dispatch(effects.two('nice'));
  const state = store.getState();
  t.deepEqual(state, { awesome: 'ok', wow: 'nice' });
});
