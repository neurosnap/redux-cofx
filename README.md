# redux-cosed [![Build Status](https://travis-ci.org/neurosnap/redux-cosed.svg?branch=master)](https://travis-ci.org/neurosnap/redux-cosed)

Sagas for thunks; `redux-saga` meets `redux-thunk`

Middleware for `redux` that allows developers to dispatch actions which trigger
generator functions.  On top of that, these generator functions have an API
for describing side-effect as opposed to activating them.  Let `redux-cosed` handle
the side-effects, all you need to worry about is describing how the side-effects
should look.

## Features

* Don't want the weight of `redux-saga` (forking model, task cancellation, spawning infinite loops, etc.)
* Like action creators spawning side-effects
* Want to describe side-effects as data
* Testing is incredibly simple
* Same API as `redux-saga` (select, put, call, spawn, all, delay)
* Typescript typings

## Install

```bash
yarn add redux-cosed
```

## Usage

```js
import cosedMiddleware, { createEffect, call, select, put } from 'redux-cosed';
import { applyMiddleware, createStore } from 'redux';

const store = createStore(
  reducers,
  applyMiddleware(cosedMiddleware),
);

// action creators
const todosSuccess = (payload) => ({
  type: 'TODO_SUCCESS',
  payload,
});
const uploadTodos = (todos) => createEffect(effect, todos);

// selector
const getApiToken = (state) => state.token;

// effect
function* effect(todos) {
  const token = yield select(getApiToken);

  const result = yield call(fetch, '/todos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(todos),
  });
  const json = yield call([result, 'json']);

  yield put(todosSuccess(json));
}

const todos = ['drop kids off at the pool', 'make dinner'];
// trigger effect
store.dispatch(uploadTodos(todos));
```

## Testing

See [cosed](https://github.com/neurosnap/cosed#testing) for instructions on
how to test an effect function.
