import { Readable, Stream, Writable } from 'stream';

export const writeToStream = (ws: Writable, data: string | Buffer | Stream) =>
  new Promise((resolve, reject) => {
    try {
      ws.on('error', reject).on('finish', () => resolve(void 0));
      ws.write(data);
      ws.end();
    } catch (error) {
      reject(error);
    }
  });

export const createDummyReadable = (data: string) => ({
  readable: new Readable({
    read() {
      this.push(data);
      this.push(null);
    },
  }),
});

export const createDummyWritable = () => {
  const received: Uint8Array[] = [];
  const writable = new Writable({
    write: (chunk, _enc, cb) => {
      try {
        received.push(chunk);
        cb();
      } catch (error) {
        cb(error);
      }
    },
  });
  const getReceived = () => Buffer.concat(received).toString();
  return { getReceived, writable };
};
