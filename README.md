# redux-cofx [![Build Status](https://travis-ci.org/neurosnap/redux-cofx.svg?branch=master)](https://travis-ci.org/neurosnap/redux-cofx)

Redux middleware: Sagas for thunks; `redux-saga` meets `redux-thunk`

Middleware for `redux` that allows developers to dispatch actions which trigger
generator functions. On top of that, these generator functions have an API
for describing side-effect as opposed to activating them. Let `redux-cofx` handle
the side-effects, all you need to worry about is describing how the side-effects
should look.

## Features

- Don't want the weight of `redux-saga` (forking model, task cancellation, spawning infinite loops, etc.)
- Like action creators spawning side-effects
- Want to describe side-effects as data
- Testing is incredibly simple
- Same API as `redux-saga` (select, put, call, spawn, all, delay)
- Typescript typings
- Upgradability from [react-cofx](https://github.com/neurosnap/react-cofx) and [redux-saga](https://github.com/redux-saga/redux-saga)

## Upgrade plan

Sometimes all we need to do is fetch data from a server and load it into one
component. That data lives inside that component and we don't need to share
it with anything else. This is where `react-cofx` shines. However, because
requirements change over time, we need to eventually share that data with
multiple components and now we need to save the data in redux. We could
use `redux-thunk` to accomplish that goal, but it's difficult to test thunks
and the way to fetch the data looks a little different than `react-cofx`.
This is where `redux-cofx` shines. The function we wrote for `react-cofx`
looks almost identical to the one we use for `redux-cofx`. The only addition
is `redux-cofx` provides the ability to query redux state and dispatch actions.
Sometimes requirements change even more and now we need the ability to listen to multiple events and other
more complex flow control mechanisms. This is when we would introduce `redux-saga`.
The `cofx` API was built with `redux-saga` in mind. It's the same exact API.
All we would need to do is change the import path for `call`, etc. to `redux-saga/effects`
and it should work exactly the same.

So what do we have? We have an upgrade path to start small (react-cofx), upgrade
to redux with simple side-effects (redux-cofx), and then upgrade to really complex
flow mechanisms (redux-saga).

`react-cofx` -> `redux-cofx` -> `redux-saga`

## Install

```bash
yarn add redux-cofx
```

## Usage

```js
import cofxMiddleware, { createEffect, call, select, put } from "redux-cofx";
import { applyMiddleware, createStore } from "redux";

const store = createStore(reducers, applyMiddleware(cofxMiddleware));

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

## Testing

See [cofx](https://github.com/neurosnap/cofx#testing) for instructions on
how to test an effect function.
