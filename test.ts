const test = require('tape');

const lib = require('.');
const cosedMiddleware = lib.default;
const { createEffect } = lib;

test('createMiddleware', (t: any) => {
  const doDispatch = () => {};
  const doGetState = () => {};
  const nextHandler = cosedMiddleware({
    dispatch: doDispatch,
    getState: doGetState,
  });

  t.plan(8);

  t.equal(typeof nextHandler, 'function', 'must return a function to handle next');
  t.equal(nextHandler.length, 1);

  let actionHandler = nextHandler();
  t.equal(typeof actionHandler, 'function', 'must return a function to handle action');
  t.equal(actionHandler.length, 1);

  actionHandler = nextHandler();
  const expectedProps = { ok: true };
  const fn = (props: any) => {
    t.pass('must activate function');
    t.deepEqual(props, expectedProps, 'must have correct props');
  };
  actionHandler(createEffect(fn, expectedProps));

  const actionObj = {};
  actionHandler = nextHandler((action: any) => {
    t.deepEqual(action, actionObj, 'must pass action to next if not a function');
  });
  actionHandler(actionObj);

  const expected = 'redux';
  actionHandler = nextHandler(() => expected);
  const outcome = actionHandler();
  t.deepEqual(outcome, expected, 'must return the return value of next if not a function');
});

test('action promise error', (t: any) => {
  t.plan(1);

  const doDispatch = (actual: any) => {
    const expected = {
      type: '@@redux-cosed/ERROR',
      payload: 'some error',
    };
    t.deepEqual(actual, expected, 'must dispatch an error with correct message');
  };
  const doGetState = () => {};
  const nextHandler = cosedMiddleware({
    dispatch: doDispatch,
    getState: doGetState,
  });

  const actionHandler = nextHandler();
  const prom = () => Promise.reject('some error');
  actionHandler(createEffect(prom));
});

test('createEffect action', (t: any) => {
  t.plan(1);

  const prom = () => {};
  const expected = {
    type: '@@redux-cosed/EFFECT',
    payload: { fn: prom, args: ['one', 'two'] },
  };
  const actual = createEffect(prom, 'one', 'two');
  t.deepEqual(actual, expected);
});
