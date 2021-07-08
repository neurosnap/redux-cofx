# redux-cofx 

[![ci](https://github.com/neurosnap/redux-cofx/actions/workflows/test.yml/badge.svg)](https://github.com/neurosnap/redux-cofx/actions/workflows/test.yml)

Redux middleware: Sagas as thunks; `redux-saga` meets `redux-thunk`

Middleware for `redux` that allows developers to dispatch actions which trigger
generator functions. On top of that, these generator functions have an API
for describing side-effect as opposed to activating them. Let `redux-cofx` handle
the side-effects, all you need to worry about is describing how the side-effects
should work.

## Features

- Action creators spawning side-effects
- Want to describe side-effects as data
- Testing is incredibly simple
- Similar API as `redux-saga` (select, put, take, call, fork, spawn, all, delay)
- Typescript support
- Upgradability from [react-cofx](https://github.com/neurosnap/react-cofx) and to [redux-saga](https://github.com/redux-saga/redux-saga)

## Install

```bash
yarn add redux-cofx
```

## Usage

```js
import cofxMiddleware, { createEffect, call, select, put } from "redux-cofx";
import { applyMiddleware, createStore } from "redux";

const reducer = (state) => state;
const store = createStore(reducer, applyMiddleware(cofxMiddleware));

// action creators
const todosSuccess = payload => ({
  type: "TODO_SUCCESS",
  payload
});
const uploadTodos = todos => createEffect(effect, todos);

// selector
const getApiToken = state => state.token;

// effect
function* effect(todos) {
  const token = yield select(getApiToken);

  const result = yield call(fetch, "/todos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(todos)
  });
  const json = yield call([result, "json"]);

  yield put(todosSuccess(json));
}

const todos = ["drop kids off at the pool", "make dinner"];
// trigger effect
store.dispatch(uploadTodos(todos));
```

Using `enableBatching` we also provide the ability to batch multiple actions
while only triggering one state change.  See the API section for more info.

## Testing

See [cofx](https://github.com/neurosnap/cofx#testing) for instructions on
how to test an effect function.

## API

For `cofx` specific effects (e.g. call, fork, spawn, delay, all), see [cofx docs](https://github.com/neurosnap/cofx)

### select

Accepts a function with state as the parameter

```js
const getToken = (state) => {
  return state.token;
}

function* effect() {
  const token = yield select(getToken);
}
```

### put

alias for `store.dispatch`

```js
const setToken = (payload) => {
  return {
    type: 'SET_TOKEN',
    payload,
  }
};

function* effect() {
  yield put(setToken('1234'));
}
```

### batch (requires enableBatching, added v2.0)

dispatch multiple actions with only a single state update.
This effect takes an array of actions and dispatches them all within a
single state update.  This is useful if there are multiple actions being dispatched in sequence
and you don't want to re-render the view all of those times.

```js
import { batch } from 'redux-cofx';

const setToken = (payload) => {
  return {
    type: 'SET_TOKEN',
    payload,
  }
};
const login = () => {
  return {
    type: 'LOGIN',
  };
}

function* effect() {
  yield batch([
    setToken('1234'),
    login(),
  ]); // this will only trigger one state update and only one re-render of react!
}
```

### take

Waits for the action to be dispatched

```js
function* effect() {
  const action = yield take('SOMETHING');
  console.log(action.payload);
}

console.log('output ->');
store.dispatch({ type: 'SOMETHING', payload: 'nice!' });

// output ->
// 'nice!'
```

## enableBatching (optional, added v2.0)

This is a higher order reducer that enables the use of `batch` which
allows multiple actions to be dispatched with a single re-render.

```js
import cofxMiddleware, { enabledBatching } from "redux-cofx";
import { applyMiddleware, createStore } from "redux";

const reducer = (state) => state;
const rootReducer = enableBatching(reducer);
const store = createStore(rootReducer, applyMiddleware(cofxMiddleware));
```

## batchActions (optional, added v2.3)

This is a simply action creator, when dispatched **outside** of an effect,
will dispatch all actions simultaneously updating redux store.

```js
import cofxMiddleware, { enabledBatching, batchActions } from "redux-cofx";
import { applyMiddleware, createStore } from "redux";

const reducer = (state) => state;
const rootReducer = enableBatching(reducer);
const store = createStore(rootReducer, applyMiddleware(cofxMiddleware));

store.dispatch(
  batchActions([
    { type: 'SOMETHING', payload: 'great' },
    { type: 'DO_I', payload: 'exist?' },
  ])
);
```

### createEffect

This function creates an effect action that you would dispatch with redux.

```js
import { put, createEffect } from 'redux-cofx';

function* effOne(payload: any) {
  // payload === 'ok'
  yield put({ type: 'AWESOME', payload });
}

const one = (payload: any) => createEffect(effOne, payload);
store.dispatch(one('ok'));
```

#### cancel an effect (added v2.0)

We also provide the ability to cancel an effect.  The cancel *must* be a promise.
When the cancel promise is `resolve`d then it will cancel the effect.

```js
import { put, createEffect } from 'redux-cofx';

function* effOne(payload: any) {
  yield delay(1000); // delay for 1 second
  yield put({ type: 'AWESOME', payload }); // payload === 'ok'
}

const cancel = () => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, 500);
});
const one = (payload: any) => createEffect({
  fn: effOne,
  args: [payload],
  cancel,
});
store.dispatch(one('ok'));
// the effect will be cancelled before the action can be dispatched!
```

### createEffects

This is a helper function to create effects based on a map of effect names to effect function.
The created effects will accept a payload and send it as a parameter to the effect function.

```js
import { put, createEffects } from 'redux-cofx';

function* effOne(payload: any) {
  // payload === 'ok'
  yield put({ type: 'AWESOME', payload });
}

function* effTwo(payload: any) {
  // payload === 'nice'
  yield put({ type: 'WOW', payload });
}

const effects = createEffects({
  one: effOne,
  two: effTwo,
});

store.dispatch(effects.one('ok'));
store.dispatch(effects.two('nice'));
```
