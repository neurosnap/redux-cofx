## v2.4.0 (12-21-2020)

- :wrench: changed the internal structure of `createMiddleware` to return the emitter and middleware

## v2.3.2 (12-21-2020)

- :wrench: export BATCH and BATCH_ACTIONS types

## v2.3.1 (12-21-2020)

- :wrench: better typing for `createEffects`

## v2.3.0 (12-21-2020)

- :bug: calling `batch` with an effect inside of it did not call the effect.
- :sparkes: new action `batchActions` that lets people dispatch a batch of actions: `store.dispatch(batchActions([...]))`

## v2.2.0 (11-26-2020)

- :wrench: better typing for `select`