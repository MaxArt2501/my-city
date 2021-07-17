const genMap = new Map();

self.addEventListener('message', event => {
  if (typeof event.data.create === 'number') {
    const token = (Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
    genMap.set(token, foo(event.data.create));
    self.postMessage({ amount: event.data.create, token });
  } else if (typeof event.data.token === 'string') {
    const generator = genMap.get(event.data.token);
    if (generator) {
      const next = generator.next();
      if (next.done) {
        genMap.delete(event.data.token);
      }
      self.postMessage({ token: event.data.token, next });
    } else {
      self.postMessage({ token: event.data.token, next: null });
    }
  }
});

function* foo(amount) {
  for (let index = 0; index < amount; index++) {
    yield 42 + index;
  }
}
