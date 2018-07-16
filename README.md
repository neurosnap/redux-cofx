# React Fetcher [![Build Status](https://travis-ci.org/neurosnap/react-fetcher.svg?branch=master)](https://travis-ci.org/neurosnap/react-fetcher)

Make async calls when rendering a component.

## Motivation

Some components need to request data but don't require being stored in redux.
For example, if the data is only being used for that one component, it is not
necessary to place it into redux.  However, leveraging lifecycle methods like
`componentDidMount` and `setState` has its own set of problems because of the way react handles
mounting.  For example, an unmounted component cannot call `setState` so if an
async request comes back when the component gets unmounted then that will result in
an error.  People get around that issue by adding a class property `this._mounted`
and then setting it to `false` when unmounting.  This adds quite a bit of complexity
to a component and some argue is an [anti-pattern](https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html).
There are also cases where the component will not unmount when you expect it to
and the async function will not be activated.

This library attempts to create a simple API for calling an async
function and returning some data to the component.  This separates data fetching
from the actual component and uses roughly the same API that `react-redux` and
`redux-saga` uses to keep things easy to test and migrate to a redux container component.

## Features

* Separates data fetching from component
* Connects a component to an async function
* Caches response of async function
* Async function has access to component's props
* Component has ability to refetch data
* Same structure as connecting a component to `redux` for easy migration
* Async function can be anything that [co](https://github.com/tj/co) can convert to a promise
* Leverages [cosed](https://github.com/neurosnap/cosed) which handles side effects as data
* Testing is simple and familiar if previously used `redux` and `redux-saga`

## Usage

```js
yarn add @neurosnap/react-fetcher
```

```js
import createFetcher from 'react-fetcher';

const fetch = window.fetch;

async function fetchMovies() {
  const resp = await fetch('http://httpbin.org/get?movies=one,two,three');
  const json = await resp.json();
  const movies = json.args.movies.split(',');

  return movies;
}

const DisplayMovies = ({ data = [] }) => (
  <div>
    {data.map((movie) => <div key={movie}>{movie}</div>)}
  </div>
);

const movieFetcher = createFetcher(fetchMovies);
const DisplayMoviesContainer = movieFetcher()(DisplayMovies);

const App = () => (
  <div>
    <DisplayMoviesContainer />
  </div>
);
```

The async function could be anything that [co](https://github.com/tj/co) supports.
A generator, a promise, an array of promises, an object of promises, even a normal function.
`react-fetcher` will take the result of what you pass it and send it to the component.

Here at ReactFetcher, Inc. we like to use [cosed](https://github.com/neurosnap/cosed)
which treats side effects as data with an API similar to `redux-saga`:

```js
import createFetcher from 'react-fetcher';
import { call } from 'cosed';

const fetch = window.fetch;

function* fetchMovies() {
  const resp = yield call(fetch, 'http://httpbin.org/get?movies=one,two,three');
  const json = yield call([resp, 'json']);
  const movies = json.args.movies.split(',');

  return movies;
}
```

Using cosed makes testing side effects simple.

Want to change the way the data gets sent to the component?  Use `mapStateToProps`

```js
import createFetcher from 'react-fetcher';

const fetch = window.fetch;

async function fetchMovies() {
  const resp = await fetch('http://httpbin.org/get?movies=one,two,three');
  const json = await resp.json();
  const movies = json.args.movies.split(',');

  return movies;
}

const DisplayMovies = ({ data = [] }) => (
  <div>
    {movies.map((movie) => <div key={movie}>{movie}</div>)}
  </div>
);

const movieFetcher = createFetcher(fetchMovies);
const mapStateToProps = (movies) => ({ movies }); // default mapStateToProps: (data, error) => ({ data, error });
const DisplayMoviesContainer = movieFetcher(mapStateToProps)(DisplayMovies);

const App = () => (
  <div>
    <DisplayMoviesContainer />
  </div>
);
```

Want to refetch data? Like `mapDispatchToProps` in redux, we have `mapRefetchToProps`
which will bust the cache and call the request again.

```js
const DisplayMovies = ({ movies = [], refetch }) => {
  return h('div', [
    h('a', { href: '#', onClick: () => { refetch() } }, 'refetch'),
    h('div', movies.map((movie) => h('div', { key: movie }, movie))),
  ]);
};

const movieFetcher = createFetcher(fetchMovies);
const mapStateToProps = (movies) => ({ movies });
const mapRefetchToProps = (refetch) => ({ refetch });
const DisplayMoviesContainer = movieFetcher(
  mapStateToProps,
  mapRefetchToProps,
)(DisplayMovies);
```

Async function also receives props sent to component

```js
function* fetchMovies({ movieName }) {
  const resp = yield call(fetch, `http://httpbin.org/get?movies=${movieName}`);
  const json = yield call([resp, 'json']);
  const movies = json.args.movies.split(',');

  return movies;
}

const DisplayMovies = ({ movies = [] }) => (
  <div>
    {movies.map((movie) => <div key={movie}>{movie}</div>)}
  </div>
);

const movieFetcher = createFetcher(fetchMovies);
const mapStateToProps = (movies) => ({ movies });
const DisplayMoviesContainer = movieFetcher(mapStateToProps)(DisplayMovies);

const App = () => (
  <div>
    <DisplayMoviesContainer movieName="Transporter" />
  </div>
);
```

Async function returns an error?  `mapStateToProps` has a second parameter for
any error states that are returned from the async function

```js
function* fetchMovies({ movieName }) {
  throw new Error('Something bad happened');
}

const DisplayMovies = ({ movies = [], error }) => {
  if (error) {
    return <div>{error.message}</div>;
  }

  return (
    <div>
      {movies.map((movie) => <div key={movie}>{movie}</div>)}
    </div>
  );
};

const movieFetcher = createFetcher(fetchMovies);
const mapStateToProps = (movies, error) => ({
  movies: movies || [],
  error,
});
const DisplayMoviesContainer = movieFetcher(mapStateToProps)(DisplayMovies);

const App = () => (
  <div>
    <DisplayMoviesContainer movieName="Transporter" />
  </div>
);
```

Want a loader?

```js
const Loader = () => <div>LOADING!</div>;
const DisplayMoviesContainer = movieFetcher(mapStateToProps)(DisplayMovies, Loader);
```
