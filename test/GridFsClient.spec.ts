import { createMock } from '@golevelup/ts-jest';
import {
  Cursor,
  Db,
  GridFSBucket,
  GridFSBucketOptions,
  GridFSBucketReadStream,
  GridFSBucketWriteStream,
  MongoClient,
  MongoError,
} from 'mongodb';
import { Readable } from 'stream';
import { match, P } from 'ts-pattern';
import {
  GridFsClient,
  GridFsClientOptions,
  GridFsClientPutObjectOptions,
  MongoURI,
} from '../packages/gridfs/src/GridFsClient';
import { createDummyWritable } from './helper';

jest.mock('mongodb', () => {
  const actual = jest.requireActual('mongodb');
  return {
    ...actual,
    GridFSBucket: jest.fn(),
    MongoClient: { connect: jest.fn() },
  };
});

describe('MongoURI', () => {
  const params: GridFsClientOptions = {
    database: 'fs',
    options: {
      auth: {
        password: 'test',
        user: 'test',
      },
      authSource: 'admin',
      replicaSet: 'rs0',
    },
    servers: ['host1:27017', 'host2:27017'],
  };

  describe('static parse()', () => {
    it('should return MongoURI instance', () => {
      const uri = MongoURI.parse(params);

      expect(uri).toBeInstanceOf(MongoURI);
      expect(uri.database).toBe(params.database);
      expect(uri.servers).toEqual(new Set(params.servers));

      const { auth, ...rest } = params.options ?? {};
      for (const [key, value] of Object.entries(auth ?? {})) {
        // @ts-expect-error
        expect(uri.auth.get(key)).toBe(value);
      }
      for (const [key, value] of Object.entries(rest)) {
        expect(uri.options.get(key)).toBe(value);
      }
    });
  });

  describe('toString()', () => {
    it('should return correct MongoDB URI string', () => {
      const uri = MongoURI.parse(params);
      const result = uri.toString();
      const [protocol, other1] = result.split('://');
      const [auth, other2] = other1.split('@');
      const [user, password] = auth.split(':');
      const [hosts, other3] = other2.split('/');
      const [database, queries] = other3.split('?');
      const queriesObj = new URLSearchParams(queries);

      expect(protocol).toBe('mongodb');
      expect(user).toBe(params.options?.auth?.user);
      expect(password).toBe(params.options?.auth?.password);
      expect(new Set(hosts.split(','))).toEqual(new Set(params.servers));
      expect(database).toBe(params.database);
      const { auth: _, ...rest } = params.options ?? {};
      expect(new Map(queriesObj.entries())).toEqual(new Map(Object.entries(rest)));
    });
  });
});

describe('GridFsClient', () => {
  const mockConnectionParams: GridFsClientOptions = {
    database: 'mocked',
    options: {
      auth: {
        user: 'testUser',
        password: 'testPass',
      },
    },
    servers: ['localhost:27017'],
  };
  const mockedCursor = createMock<Cursor>({
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
  });
  const mockedBucket = createMock<GridFSBucket>({
    delete: jest.fn(),
    drop: jest.fn(),
    find: jest.fn().mockReturnValue(mockedCursor),
    openDownloadStream: jest.fn(),
    openUploadStream: jest.fn(),
  });
  const mockedClient = createMock<MongoClient>({
    close: jest.fn(),
    connect: jest.fn(),
    db: jest.fn(),
    isConnected: jest.fn(),
  });

  const filename = '/samples/test.txt';
  const uri = 'mongodb://';

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error
    jest.mocked(MongoClient.connect).mockResolvedValue(mockedClient);
    jest.spyOn(MongoURI, 'parse').mockReturnValue(
      createMock<MongoURI>({
        toString: jest.fn().mockReturnValue(uri),
      })
    );
  });

  describe('constructor', () => {
    it('should behave as expected', async () => {
      const client = new GridFsClient(mockConnectionParams);

      expect(client).toBeInstanceOf(GridFsClient);
      expect(MongoURI.parse).toHaveBeenCalledWith(mockConnectionParams);
    });
  });

  describe('connect', () => {
    it('should connect', async () => {
      const client = new GridFsClient(mockConnectionParams);
      await expect(client.connect()).resolves.not.toThrow();

      expect(MongoClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    describe('when connected', () => {
      it('should disconnect', async () => {
        const client = new GridFsClient(mockConnectionParams);
        await client.connect();
        await expect(client.disconnect()).resolves.not.toThrow();

        expect(mockedClient.close).toHaveBeenCalledTimes(1);
      });
    });

    describe('when not connected', () => {
      it('should not disconnect', async () => {
        const uri = 'mongodb://';
        jest.spyOn(MongoURI, 'parse').mockReturnValue(
          createMock<MongoURI>({
            toString: jest.fn().mockReturnValue(uri),
          })
        );
        const client = new GridFsClient(mockConnectionParams);
        await expect(client.disconnect()).resolves.not.toThrow();

        expect(mockedClient.close).not.toHaveBeenCalled();
      });
    });
  });

  describe('getBucket()', () => {
    it('should return instance of GridFsBucket', async () => {
      const options: GridFSBucketOptions = {};
      const mockedBucket = createMock<GridFSBucket>({});
      const mockedDb = createMock<Db>({});
      jest.mocked(GridFSBucket).mockImplementation(() => mockedBucket);
      // @ts-expect-error
      jest.mocked(MongoClient.connect).mockResolvedValue(mockedClient);
      jest.mocked(mockedClient.db).mockReturnValue(mockedDb);

      const uri = 'mongodb://';
      jest.spyOn(MongoURI, 'parse').mockReturnValue(
        createMock<MongoURI>({
          toString: jest.fn().mockReturnValue(uri),
        })
      );

      const client = new GridFsClient(mockConnectionParams);
      await client.connect();
      await expect(client.getBucket(options)).resolves.toBe(mockedBucket);

      expect(mockedClient.db).toHaveBeenCalledWith(mockConnectionParams.database);
      expect(GridFSBucket).toHaveBeenCalledWith(mockedDb, options);
    });
  });

  describe('deleteObject()', () => {
    beforeAll(() => {
      jest.spyOn(GridFsClient.prototype, 'connect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'disconnect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'getBucket').mockResolvedValue(mockedBucket);
    });

    afterAll(() => {
      jest.mocked(GridFsClient.prototype.connect).mockRestore();
      jest.mocked(GridFsClient.prototype.disconnect).mockRestore();
      jest.mocked(GridFsClient.prototype.getBucket).mockRestore();
    });

    const mockedObject = { _id: 'mockId', filename };

    const disposeCases = [true, false, undefined] as const;
    describe.each(disposeCases)('with shouldBeDispose = %s', (disposeCase) => {
      const shouldBeDisposed = match(disposeCase)
        .returnType<boolean>()
        .with(false, () => false)
        .otherwise(() => true);

      describe('when object exists', () => {
        beforeEach(() => {
          // @ts-expect-error
          mockedCursor.toArray.mockResolvedValue([mockedObject]);
        });

        describe('when bucket.delete() throws', () => {
          const error = new MongoError('error');

          it('should throw', async () => {
            mockedBucket.delete.mockImplementation((_, cb) => {
              if (cb !== undefined) {
                cb(error);
              }
            });

            const client = new GridFsClient(mockConnectionParams);
            await expect(client.deleteObject(filename, shouldBeDisposed)).rejects.toThrow(error);

            expect(client.connect).toHaveBeenCalledTimes(1);
            expect(client.disconnect).toHaveBeenCalledTimes(shouldBeDisposed ? 1 : 0);
            expect(client.getBucket).toHaveBeenCalledTimes(1);
            expect(mockedBucket.find).toHaveBeenCalledWith({ filename });
            expect(mockedCursor.limit).toHaveBeenCalledWith(1);
            expect(mockedCursor.toArray).toHaveBeenCalledTimes(1);
            expect(mockedBucket.delete).toHaveBeenCalledTimes(1);
          });
        });

        describe('when bucket.delete() not throw', () => {
          it('should delete object', async () => {
            mockedBucket.delete.mockImplementation((_, cb) => {
              if (cb !== undefined) {
                cb(null);
              }
            });

            const client = new GridFsClient(mockConnectionParams);
            await expect(client.deleteObject(filename, shouldBeDisposed)).resolves.not.toThrow();

            expect(client.connect).toHaveBeenCalledTimes(1);
            expect(client.getBucket).toHaveBeenCalledTimes(1);
            expect(client.disconnect).toHaveBeenCalledTimes(shouldBeDisposed ? 1 : 0);
            expect(mockedBucket.find).toHaveBeenCalledWith({ filename });
            expect(mockedCursor.limit).toHaveBeenCalledWith(1);
            expect(mockedCursor.toArray).toHaveBeenCalled();
            expect(mockedBucket.delete).toHaveBeenCalledWith(
              mockedObject._id,
              expect.any(Function)
            );
          });
        });
      });

      describe('when object not exists', () => {
        beforeEach(() => {
          // @ts-expect-error
          mockedCursor.toArray.mockResolvedValue([]);
        });

        it('should throw', async () => {
          const client = new GridFsClient(mockConnectionParams);
          await expect(client.deleteObject(filename, shouldBeDisposed)).rejects.toThrow(
            `Object not found: ${filename}`
          );

          expect(client.connect).toHaveBeenCalledTimes(1);
          expect(client.disconnect).toHaveBeenCalledTimes(shouldBeDisposed ? 1 : 0);
          expect(client.getBucket).toHaveBeenCalledTimes(1);
          expect(mockedBucket.find).toHaveBeenCalledWith({ filename });
          expect(mockedCursor.limit).toHaveBeenCalledWith(1);
          expect(mockedCursor.toArray).toHaveBeenCalled();
          expect(mockedBucket.delete).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('getObject()', () => {
    beforeAll(() => {
      jest.spyOn(GridFsClient.prototype, 'connect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'disconnect');
      jest.spyOn(GridFsClient.prototype, 'getBucket').mockResolvedValue(mockedBucket);
    });

    afterAll(() => {
      jest.mocked(GridFsClient.prototype.connect).mockRestore();
      jest.mocked(GridFsClient.prototype.disconnect).mockRestore();
      jest.mocked(GridFsClient.prototype.getBucket).mockRestore();
    });

    describe('when object exists', () => {
      const mockedObject = { _id: 'mockId', filename };
      // const stream = createMock<GridFSBucketReadStream>({ on: jest.fn().mockReturnThis() });
      const stream = new Readable() as GridFSBucketReadStream;

      beforeAll(() => {
        jest.spyOn(stream, 'on');
      });

      beforeEach(() => {
        // @ts-expect-error
        mockedCursor.toArray.mockResolvedValue([mockedObject]);
        mockedBucket.openDownloadStream.mockReturnValue(stream);
      });

      afterAll(() => {
        jest.mocked(stream.on).mockRestore();
      });

      describe('when disconnect() not throws', () => {
        beforeEach(() => {
          jest.mocked(GridFsClient.prototype.disconnect).mockResolvedValue(void 0);
        });

        it('should get an object', async () => {
          const client = new GridFsClient(mockConnectionParams);
          await expect(client.getObject(filename)).resolves.toBe(stream);

          expect(client.connect).toHaveBeenCalledTimes(1);
          expect(client.getBucket).toHaveBeenCalledTimes(1);
          expect(client.disconnect).not.toHaveBeenCalled;
          expect(mockedBucket.find).toHaveBeenCalledWith({ filename });
          expect(mockedCursor.limit).toHaveBeenCalledWith(1);
          expect(mockedCursor.toArray).toHaveBeenCalled();
          expect(mockedBucket.openDownloadStream).toHaveBeenCalledWith(mockedObject._id);
          expect(stream.on).toHaveBeenCalledTimes(1);

          const [event, listener] = jest.mocked(stream.on).mock.lastCall ?? [];
          expect(event).toBe('close');
          expect(listener).toBeInstanceOf(Function);

          stream.emit('close');
          expect(client.disconnect).toHaveBeenCalledTimes(1);
        });
      });

      describe('when disconnect() throws error', () => {
        const mockedError = new Error('Mocked disconnect error');

        beforeEach(() => {
          jest.mocked(GridFsClient.prototype.disconnect).mockRejectedValue(mockedError);
        });

        it('should throw error', async () => {
          const client = new GridFsClient(mockConnectionParams);
          const result = await client.getObject(filename);

          expect(result).toBe(stream);
          expect(client.disconnect).toHaveBeenCalledTimes(0);

          const [event, listener] = jest.mocked(stream.on).mock.lastCall ?? [];
          expect(event).toBe('close');
          expect(listener).toBeInstanceOf(Function);
          await expect(listener).rejects.toThrow(mockedError);
          expect(client.disconnect).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when object not exists', () => {
      beforeEach(() => {
        jest.mocked(GridFsClient.prototype.disconnect).mockResolvedValue(void 0);
        // @ts-expect-error
        mockedCursor.toArray.mockResolvedValue([]);
      });

      it('should return null', async () => {
        const client = new GridFsClient(mockConnectionParams);
        await expect(client.getObject(filename)).resolves.toBeNull();

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.getBucket).toHaveBeenCalledTimes(1);
        expect(client.disconnect).toHaveBeenCalledTimes(1);
        expect(mockedBucket.find).toHaveBeenCalledWith({ filename });
        expect(mockedCursor.limit).toHaveBeenCalledWith(1);
        expect(mockedCursor.toArray).toHaveBeenCalled();
        expect(mockedBucket.openDownloadStream).not.toHaveBeenCalled();
      });
    });
  });

  describe('listObjects()', () => {
    beforeAll(() => {
      jest.spyOn(GridFsClient.prototype, 'connect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'disconnect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'getBucket').mockResolvedValue(mockedBucket);
    });

    afterAll(() => {
      jest.mocked(GridFsClient.prototype.connect).mockRestore();
      jest.mocked(GridFsClient.prototype.disconnect).mockRestore();
      jest.mocked(GridFsClient.prototype.getBucket).mockRestore();
    });

    describe('when found', () => {
      it('should list objects in a container', async () => {
        const pattern = new RegExp(`^${filename}`);
        const expected = [{ filename }];
        // @ts-expect-error
        mockedCursor.toArray.mockResolvedValue(expected);

        const client = new GridFsClient(mockConnectionParams);
        await expect(client.listObjects(pattern)).resolves.toEqual(expected);

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.getBucket).toHaveBeenCalledWith();
        expect(client.disconnect).toHaveBeenCalledTimes(1);
        expect(mockedBucket.find).toHaveBeenCalledWith({
          filename: { $regex: pattern },
        });
        expect(mockedCursor.limit).not.toHaveBeenCalled();
        expect(mockedCursor.toArray).toHaveBeenCalledWith();
      });
    });

    describe('when not found', () => {
      it('should return empty array', async () => {
        const pattern = new RegExp(`^${filename}`);
        const expected = [];
        // @ts-expect-error
        mockedCursor.toArray.mockResolvedValue(expected.map((filename) => ({ filename })));

        const client = new GridFsClient(mockConnectionParams);
        await expect(client.listObjects(pattern)).resolves.toEqual(expected);

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.getBucket).toHaveBeenCalledWith();
        expect(client.disconnect).toHaveBeenCalledTimes(1);
        expect(mockedBucket.find).toHaveBeenCalledWith({
          filename: { $regex: pattern },
        });
        expect(mockedCursor.limit).not.toHaveBeenCalled();
        expect(mockedCursor.toArray).toHaveBeenCalledWith();
      });
    });
  });

  describe('putObject()', () => {
    beforeAll(() => {
      jest.spyOn(GridFsClient.prototype, 'connect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'disconnect').mockResolvedValue(void 0);
      jest.spyOn(GridFsClient.prototype, 'getBucket').mockResolvedValue(mockedBucket);
      jest.spyOn(GridFsClient.prototype, 'deleteObject').mockResolvedValue(void 0);
    });

    afterAll(() => {
      jest.mocked(GridFsClient.prototype.connect).mockRestore();
      jest.mocked(GridFsClient.prototype.disconnect).mockRestore();
      jest.mocked(GridFsClient.prototype.getBucket).mockRestore();
      jest.mocked(GridFsClient.prototype.deleteObject).mockRestore();
    });

    const data = 'test data';

    describe('with options', () => {
      const replaceOptionCases = [true, false, undefined] as const;
      describe.each(replaceOptionCases)('with replace = %s', (replaceCase) => {
        const streamOptionsCases = ['defined', 'undefined'] as const;
        describe.each(streamOptionsCases)('with streamOptions is %s', (streamOptionsCase) => {
          const pipelineResultCases = ['succeeds', 'fails'] as const;
          describe.each(pipelineResultCases)('when pipeline %s', (pipelineResultCase) => {
            const stream = Readable.from([data]);
            const { getReceived, writable } = createDummyWritable();
            const error = new Error('Pipeline failed');

            beforeEach(() => {
              mockedBucket.openUploadStream.mockReturnValue(writable as GridFSBucketWriteStream);
              if (pipelineResultCase === 'fails') {
                stream.on = jest.fn().mockImplementation((event, handler) => {
                  if (event === 'data') {
                    setTimeout(() => handler(Buffer.from(data)), 0);
                  } else if (event === 'end') {
                    setTimeout(() => {
                      writable.emit('error', error);
                    }, 0);
                  }
                  return stream;
                });
              }
            });

            const putOptions = match({ replaceCase, streamOptionsCase })
              .returnType<GridFsClientPutObjectOptions>()
              .with({ replaceCase: true, streamOptionsCase: 'defined' }, () => ({
                replace: true,
                streamOptions: { chunkSizeBytes: 1024 * 1024 },
              }))
              .with({ replaceCase: true, streamOptionsCase: 'undefined' }, () => ({
                replace: true,
              }))
              .with({ replaceCase: false, streamOptionsCase: 'defined' }, () => ({
                streamOptions: { chunkSizeBytes: 1024 * 1024 },
              }))
              .with({ replaceCase: false, streamOptionsCase: 'undefined' }, () => ({
                replace: false,
              }))
              .with({ replaceCase: undefined, streamOptionsCase: 'defined' }, () => ({
                streamOptions: { chunkSizeBytes: 1024 * 1024 },
              }))
              .with({ replaceCase: undefined, streamOptionsCase: 'undefined' }, () => ({}))
              .exhaustive();

            const assertPutObjectFn = (client: GridFsClient, filename: string) =>
              match(pipelineResultCase)
                .returnType<Promise<void>>()
                .with('fails', () =>
                  expect(client.putObject(filename, stream, putOptions)).rejects.toThrow(error)
                )
                .with('succeeds', () =>
                  expect(client.putObject(filename, stream, putOptions)).resolves.not.toThrow()
                )
                .exhaustive();

            const assertDeleteObjectFn = (client: GridFsClient, filename: string) =>
              match(putOptions?.replace)
                .with(true, () => {
                  expect(client.deleteObject).toHaveBeenCalledTimes(1);
                  expect(client.deleteObject).toHaveBeenCalledWith(filename, false);
                })
                .otherwise(() => {
                  expect(client.deleteObject).not.toHaveBeenCalled();
                });

            const conditionTitle = [
              pipelineResultCase === 'succeeds' ? 'put' : 'fail to put',
              'an object',
              replaceCase ? 'after deleting exists' : 'without deleting exists',
            ].join(' ');

            it(`should ${conditionTitle}`, async () => {
              const client = new GridFsClient(mockConnectionParams);
              await assertPutObjectFn(client, filename);

              expect(client.connect).toHaveBeenCalledTimes(1);
              assertDeleteObjectFn(client, filename);
              expect(client.getBucket).toHaveBeenCalledWith();
              expect(client.disconnect).toHaveBeenCalledTimes(1);
              expect(mockedBucket.openUploadStream).toHaveBeenCalledWith(
                filename,
                putOptions.streamOptions
              );
              expect(getReceived().toString()).toBe(data.toString());
            });
          });
        });
      });
    });

    describe('without options', () => {
      const pipelineResultCases = ['succeeds', 'fails'] as const;
      describe.each(pipelineResultCases)('when pipeline %s', (pipelineResultCase) => {
        const stream = Readable.from([data]);
        const { getReceived, writable } = createDummyWritable();
        const error = new Error('Pipeline failed');

        beforeEach(() => {
          mockedBucket.openUploadStream.mockReturnValue(writable as GridFSBucketWriteStream);
          if (pipelineResultCase === 'fails') {
            stream.on = jest.fn().mockImplementation((event, handler) => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from(data)), 0);
              } else if (event === 'end') {
                setTimeout(() => {
                  writable.emit('error', error);
                }, 0);
              }
              return stream;
            });
          }
        });

        const assertPutObjectFn = (client: GridFsClient, filename: string) =>
          match(pipelineResultCase)
            .returnType<Promise<void>>()
            .with('fails', () => expect(client.putObject(filename, stream)).rejects.toThrow(error))
            .with('succeeds', () =>
              expect(client.putObject(filename, stream)).resolves.not.toThrow()
            )
            .exhaustive();

        const conditionTitle = pipelineResultCase === 'succeeds' ? 'put' : 'fail to put';
        it(`should ${conditionTitle} an object without deleting exists`, async () => {
          const client = new GridFsClient(mockConnectionParams);
          await assertPutObjectFn(client, filename);

          expect(client.connect).toHaveBeenCalledTimes(1);
          expect(client.deleteObject).not.toHaveBeenCalled();
          expect(client.getBucket).toHaveBeenCalledWith();
          expect(client.disconnect).toHaveBeenCalledTimes(1);
          expect(mockedBucket.openUploadStream).toHaveBeenCalledWith(filename, undefined);
          expect(getReceived().toString()).toBe(data.toString());
        });
      });
    });
  });
});
