import { createMock } from '@golevelup/ts-jest';
import { Cursor, GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream } from 'mongodb';
import { Readable, Stream } from 'stream';
import {
  GridFsClient,
  GridFsClientOptions,
  GridFsObject,
} from '../packages/gridfs/src/GridFsClient';
import { GridFSPutObjectOptions, GridFsProvider } from '../packages/gridfs/src/GridFsProvider';
import { createDummyWritable, readFromStream } from './helper';

jest.mock('../packages/gridfs/src/GridFsClient');

describe('GridFsProvider', () => {
  const mockConnectionParams: GridFsClientOptions = {
    database: 'mock',
    servers: ['localhost:27017'],
  };
  const bucketName = 'mockContainer';
  const fileName = 'testfile.txt';
  const fullPath = [bucketName, fileName].join('/');
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
  const mockedClient = createMock<GridFsClient>({
    connect: jest.fn().mockResolvedValue(void 0),
    disconnect: jest.fn().mockResolvedValue(void 0),
    getBucket: jest.fn().mockResolvedValue(mockedBucket),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(GridFsClient).mockReturnValue(mockedClient);
  });

  describe('constructor', () => {
    it('should create a provider with connection params', async () => {
      const provider = new GridFsProvider(mockConnectionParams);

      expect(provider).toBeInstanceOf(GridFsProvider);
      expect(provider.provider).toBe('gridfs');
      expect(provider.client).toBe(mockedClient);
      expect(GridFsClient).toHaveBeenCalledWith(mockConnectionParams);
    });
  });

  describe('createContainer()', () => {
    it('should create a container', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.createContainer(bucketName, {})).resolves.not.toThrow();
    });
  });

  describe('deleteContainer()', () => {
    describe('when container has objects', () => {
      it('should delete a container', async () => {
        const files = [`${bucketName}/file1.txt`, `${bucketName}/file2.txt`];
        mockedClient.listObjects.mockResolvedValue(
          files.map((file) => createMock<GridFsObject>({ filename: file }))
        );
        mockedClient.deleteObject.mockResolvedValue(void 0);
        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.deleteContainer(bucketName)).resolves.not.toThrow();

        expect(mockedClient.listObjects).toHaveBeenCalledTimes(1);
        expect(mockedClient.listObjects).toHaveBeenCalledWith(
          new RegExp('^' + [bucketName, '*'].join('/'))
        );
        expect(mockedClient.connect).toHaveBeenCalledTimes(1);
        expect(mockedClient.deleteObject).toHaveBeenCalledTimes(files.length);
        for (const [index, filename] of files.entries()) {
          expect(mockedClient.deleteObject).toHaveBeenNthCalledWith(index + 1, filename, false);
        }
        expect(mockedClient.disconnect).toHaveBeenCalledTimes(1);
      });
    });

    describe('when container has no objects', () => {
      it('should not delete container', async () => {
        mockedClient.listObjects.mockResolvedValue([]);
        mockedClient.deleteObject.mockResolvedValue(void 0);
        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.deleteContainer(bucketName)).resolves.not.toThrow();

        expect(mockedClient.listObjects).toHaveBeenCalledTimes(1);
        expect(mockedClient.listObjects).toHaveBeenCalledWith(
          new RegExp('^' + [bucketName, '*'].join('/'))
        );
        expect(mockedClient.connect).not.toHaveBeenCalled();
        expect(mockedClient.deleteObject).not.toHaveBeenCalled();
        expect(mockedClient.disconnect).not.toHaveBeenCalled();
      });
    });
  });

  describe('ensureContainer()', () => {
    it('should ensure a container exists', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.ensureContainer(bucketName, {})).resolves.not.toThrow();
    });
  });

  describe('isContainer()', () => {
    it('should check if a container exists', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.isContainer(bucketName)).resolves.toBe(true);
    });
  });

  describe('listContainers()', () => {
    it('should list containers', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.listContainers()).resolves.toEqual([]);
    });
  });

  describe('getObject()', () => {
    describe('when object exists', () => {
      it('should get an object', async () => {
        const stream = createMock<GridFSBucketReadStream>({});
        mockedClient.getObject.mockResolvedValue(stream);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.getObject(bucketName, fileName)).resolves.toBe(stream);

        expect(mockedClient.getObject).toHaveBeenCalledWith(fullPath);
      });
    });

    describe('when object not exists', () => {
      it('should throw', async () => {
        mockedClient.getObject.mockResolvedValue(null);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.getObject(bucketName, fileName)).resolves.toBeNull();

        expect(mockedClient.getObject).toHaveBeenCalledWith(fullPath);
      });
    });
  });

  describe('putObject()', () => {
    const data = 'test data';
    const options = createMock<GridFSPutObjectOptions>({});

    describe('when received data as Stream', () => {
      it('should put an object', async () => {
        const stream = Readable.from(data);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(
          provider.putObject(bucketName, fileName, stream, options)
        ).resolves.not.toThrow();

        expect(mockedClient.putObject).toHaveBeenCalledWith(fullPath, stream, options.metadata);
      });
    });

    describe('when received data as Buffer', () => {
      it('should put an object from a buffer', async () => {
        const buffer = Buffer.from(data);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(
          provider.putObject(bucketName, fileName, buffer, options)
        ).resolves.not.toThrow();

        expect(mockedClient.putObject).toHaveBeenCalledWith(
          fullPath,
          expect.any(Stream),
          options.metadata
        );

        const [_1, stream] = mockedClient.putObject.mock.lastCall;
        await expect(readFromStream(stream as Readable)).resolves.toBe(data);
      });
    });

    describe('when received data as string', () => {
      it('should put an object from a string', async () => {
        const provider = new GridFsProvider(mockConnectionParams);
        await expect(
          provider.putObject(bucketName, fileName, data, options)
        ).resolves.not.toThrow();

        expect(mockedClient.putObject).toHaveBeenCalledWith(
          fullPath,
          expect.any(Stream),
          options.metadata
        );

        const [_1, stream] = mockedClient.putObject.mock.lastCall;
        await expect(readFromStream(stream as Readable)).resolves.toBe(data);
      });
    });

    describe('when received data as invalid type', () => {
      it('should throw on invalid data', async () => {
        const { writable } = createDummyWritable();
        mockedBucket.openUploadStream.mockReturnValue(
          createMock<GridFSBucketWriteStream>(writable)
        );

        const provider = new GridFsProvider(mockConnectionParams);
        // @ts-expect-error: Testing invalid input
        await expect(provider.putObject(bucketName, fileName, 123)).rejects.toThrow();
        expect(mockedClient.connect).not.toHaveBeenCalled();
        expect(mockedClient.getBucket).not.toHaveBeenCalled();
        expect(mockedClient.disconnect).not.toHaveBeenCalled();
        expect(mockedBucket.openUploadStream).not.toHaveBeenCalled();
      });
    });
  });

  describe('listObjects()', () => {
    describe('when called with prefix', () => {
      it('should list objects in a container', async () => {
        const prefix = '.*';
        const pattern = new RegExp('^' + [bucketName, prefix].join('/'));
        const files = [`${bucketName}/file1.txt`, `${bucketName}/file2.txt`];
        const listItems = files.map((filename) =>
          createMock<GridFsObject>({
            filename,
            md5: '',
            length: 0,
            uploadDate: '1970-01-01T09:00:00Z',
          })
        );
        const listItemObjects = listItems.map((item) => ({
          contentMD5: item.md5,
          lastModified: new Date(item.uploadDate),
          path: item.filename,
          size: item.length,
        }));

        mockedClient.listObjects.mockResolvedValue(listItems);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.listObjects(bucketName, prefix)).resolves.toEqual(listItemObjects);

        expect(mockedClient.listObjects).toHaveBeenCalledWith(pattern);
      });
    });

    describe('when called without prefix', () => {
      it('should list objects in a container', async () => {
        const pattern = new RegExp('^' + [bucketName].join('/'));
        const files = [`${bucketName}/file1.txt`, `${bucketName}/file2.txt`];
        const listItems = files.map((filename) =>
          createMock<GridFsObject>({
            filename,
            md5: '',
            length: 0,
            uploadDate: '1970-01-01T09:00:00Z',
          })
        );
        const listItemObjects = listItems.map((item) => ({
          contentMD5: item.md5,
          lastModified: new Date(item.uploadDate),
          path: item.filename,
          size: item.length,
        }));

        mockedClient.listObjects.mockResolvedValue(listItems);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.listObjects(bucketName)).resolves.toEqual(listItemObjects);

        expect(mockedClient.listObjects).toHaveBeenCalledWith(pattern);
      });
    });
  });

  describe('deleteObject()', () => {
    describe('when object exists', () => {
      it('should delete an object', async () => {
        mockedClient.deleteObject.mockResolvedValue(void 0);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.deleteObject(bucketName, fileName)).resolves.not.toThrow();

        expect(mockedClient.deleteObject).toHaveBeenCalledWith(fullPath);
      });
    });

    describe('when object not exists', () => {
      it('should throw', async () => {
        const error = new Error(`Object not found: ${fullPath}`);
        mockedClient.deleteObject.mockRejectedValue(error);

        const provider = new GridFsProvider(mockConnectionParams);
        await expect(provider.deleteObject(bucketName, fileName)).rejects.toThrow(error);

        expect(mockedClient.deleteObject).toHaveBeenCalledWith(fullPath);
      });
    });
  });

  describe('presignedGetUrl()', () => {
    it('should get a presigned url', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.presignedGetUrl(bucketName, fileName)).resolves.toBe('');
    });
  });

  describe('presignedPutUrl()', () => {
    it('should put a presigned url', async () => {
      const provider = new GridFsProvider(mockConnectionParams);
      await expect(provider.presignedPutUrl(bucketName, fileName)).resolves.toBe('');
    });
  });
});
