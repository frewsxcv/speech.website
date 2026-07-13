// Safari (through at least 18) does not implement async iteration of
// ReadableStream — `ReadableStream.prototype[Symbol.asyncIterator]` and
// `.values()` are missing, a long-standing WebKit gap that Chromium and
// Firefox shipped years ago. phonemizer 1.2.1 unpacks its bundled
// pronunciation dictionary at *module-evaluation* time with
//   for await (const chunk of blob.stream().pipeThrough(new DecompressionStream("gzip")))
// so merely importing it (which Kokoro and KittenTTS both do transitively)
// throws "TypeError: undefined is not a function" on Safari and the model
// never loads. Install the standard reader-based async-iterator polyfill so
// that pattern works. This module must be imported before any TTS library.
if (
  typeof ReadableStream !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !(ReadableStream.prototype as any)[Symbol.asyncIterator]
) {
  function values(this: ReadableStream<unknown>, { preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      next() {
        return reader.read().then(
          (result) => {
            if (result.done) reader.releaseLock();
            return result;
          },
          (reason) => {
            reader.releaseLock();
            throw reason;
          },
        );
      },
      return(value?: unknown) {
        const cancelled = preventCancel ? Promise.resolve() : reader.cancel(value);
        return cancelled.then(() => {
          reader.releaseLock();
          return { done: true, value };
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ReadableStream.prototype as any).values = values;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ReadableStream.prototype as any)[Symbol.asyncIterator] = values;
}
