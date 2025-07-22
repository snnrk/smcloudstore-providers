import { Readable, Stream, Writable } from 'stream';

export const readFromStream = (rs: Readable) =>
  new Promise<string>((resolve, reject) => {
    const buffer: Uint8Array[] = [];
    rs.on('data', (chunk: Buffer) => {
      buffer.push(Uint8Array.from(chunk));
    });
    rs.on('end', () => resolve(Buffer.concat(buffer).toString()));
    rs.on('error', (error) => reject(error));
    rs.read();
  });

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
