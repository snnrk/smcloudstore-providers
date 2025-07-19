import { createMock } from '@golevelup/ts-jest';
import { LocalFsBucket, LocalFsClient, LocalFsFile } from '../packages/localfs/src/LocalFsClient';
import { LocalFsProvider } from '../packages/localfs/src/LocalFsProvider';
import { createDummyReadable, createDummyWritable } from './helper';

jest.mock('../packages/localfs/src/LocalFsClient');

describe('LocalFsProvider', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should create a new instance', async () => {
    // #region Given
    const connection = { rootDir: '/data' };
    // #endregion

    // #region When
    const run = () =>
      new Promise((resolve, reject) => {
        try {
          resolve(new LocalFsProvider(connection));
        } catch (error) {
          reject(error);
        }
      });
    // #endregion

    // #region Then
    await expect(run()).resolves.toBeInstanceOf(LocalFsProvider);
    // #endregion
  });

  describe('createContainer()', () => {
    it('should create bucket instance and call bucket.create()', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const options = {};
      const provider = new LocalFsProvider(connection);
      const bucket = createMock<LocalFsBucket>({ create: jest.fn() });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.createContainer(container, options);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledWith(container);
      expect(bucket.create).toHaveBeenCalledWith(options);
      // #endregion
    });
  });

  describe('deleteContainer()', () => {
    it('should create bucket instance and call bucket.delete()', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const provider = new LocalFsProvider(connection);
      const bucket = createMock<LocalFsBucket>({ delete: jest.fn() });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.deleteContainer(container);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledWith(container);
      expect(bucket.delete).toHaveBeenCalledWith();
      // #endregion
    });
  });

  describe('ensureContainer()', () => {
    it('should not call bucket.create if bucket.exists returns true', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const options = {};
      const expected = true;
      const provider = new LocalFsProvider(connection);
      const bucket = createMock<LocalFsBucket>({
        create: jest.fn(),
        exists: jest.fn().mockResolvedValue(expected),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.ensureContainer(container, options);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledTimes(1);
      expect(LocalFsClient.prototype.bucket).toHaveBeenNthCalledWith(1, container);
      expect(bucket.exists).toHaveBeenCalledWith();
      expect(bucket.create).not.toHaveBeenCalled();
      // #endregion
    });

    it('should call bucket.create if bucket.exists returns false', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const options = {};
      const expected = false;
      const provider = new LocalFsProvider(connection);
      const bucket = createMock<LocalFsBucket>({
        create: jest.fn(),
        exists: jest.fn().mockResolvedValue(expected),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.ensureContainer(container, options);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledTimes(2);
      expect(LocalFsClient.prototype.bucket).toHaveBeenNthCalledWith(1, container);
      expect(bucket.exists).toHaveBeenCalledWith();
      expect(LocalFsClient.prototype.bucket).toHaveBeenNthCalledWith(2, container);
      expect(bucket.create).toHaveBeenCalledWith(options);
      // #endregion
    });
  });

  describe('isContainer()', () => {
    it('should create bucket instance, call bucket.exists() and return its returns', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const expected = true;
      const provider = new LocalFsProvider(connection);
      const bucket = createMock<LocalFsBucket>({
        exists: jest.fn().mockResolvedValue(expected),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.isContainer(container);
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual(expected);
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledWith(container);
      expect(bucket.exists).toHaveBeenCalledWith();
      // #endregion
    });
  });

  describe('listContainers()', () => {
    it('should return a list of containers', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const provider = new LocalFsProvider(connection);
      const expected = ['bucket1', 'bucket2'];
      const buckets = expected.map((path) => createMock<LocalFsBucket>({ path }));
      jest.mocked(LocalFsClient.prototype.getBuckets).mockResolvedValue(buckets);
      // #endregion

      // #region When
      const run = () => provider.listContainers();
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual(expected);
      expect(LocalFsClient.prototype.getBuckets).toHaveBeenCalledTimes(1);
      // #endregion
    });
  });

  describe('deleteObject()', () => {
    it('should get file instance and call file.delete()', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = '/bucket1';
      const path = 'file1';
      const provider = new LocalFsProvider(connection);
      const file = { delete: jest.fn() };
      const bucket = createMock<LocalFsBucket>({
        file: jest.fn().mockResolvedValue(file),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.deleteObject(container, path);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(bucket.file).toHaveBeenCalledWith(path);
      expect(file.delete).toHaveBeenCalledWith();
      // #endregion
    });
  });

  describe('getObject()', () => {
    it('should get file instance and call file.createReadStream()', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = '/bucket1';
      const path = 'file1';
      const provider = new LocalFsProvider(connection);
      const file = { createReadStream: jest.fn() };
      const bucket = createMock<LocalFsBucket>({
        file: jest.fn().mockResolvedValue(file),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.getObject(container, path);
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeUndefined();
      expect(bucket.file).toHaveBeenCalledWith(path);
      expect(file.createReadStream).toHaveBeenCalledWith();
      // #endregion
    });
  });

  describe('listObjects()', () => {
    it('should return a list of objects in the container', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = '/bucket1';
      const prefix = undefined;
      const provider = new LocalFsProvider(connection);
      const expected = Array.from({ length: 10 }, (_, i) => ({
        path: `file${i + 1}`,
        size: 10,
        lastModified: new Date(),
        creationTime: new Date(),
      }));
      const files = expected.map(({ path, ...stat }) => {
        const obj = { name: path, stat: jest.fn() };
        obj.stat.mockResolvedValue({
          path,
          size: stat.size,
          mtime: stat.lastModified,
          birthtime: stat.creationTime,
        });
        return obj;
      });
      const bucket = createMock<LocalFsBucket>({
        getFiles: jest.fn().mockResolvedValue(files),
      });
      jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);
      // #endregion

      // #region When
      const run = () => provider.listObjects(container, prefix);
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual(expected);
      expect(LocalFsClient.prototype.bucket).toHaveBeenCalledWith(container);
      expect(bucket.getFiles).toHaveBeenCalledWith();
      files.forEach((file) => {
        expect(file.stat).toHaveBeenCalledTimes(1);
      });
      // #endregion
    });
  });

  describe('putObject()', () => {
    describe('when data is stream', () => {
      it('should put an object into the container', async () => {
        // #region Given
        const connection = { rootDir: '/data' };
        const container = '/bucket1';
        const path = 'file1';
        const data = 'data';
        const options = { metadata: {} };

        const provider = new LocalFsProvider(connection);
        const { getReceived, writable } = createDummyWritable();
        const file = createMock<LocalFsFile>({ createWriteStream: jest.fn(() => writable) });
        const bucket = createMock<LocalFsBucket>({
          file: jest.fn().mockResolvedValue(file),
        });
        jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);

        const given = [
          container,
          path,
          createDummyReadable(data).readable,
          options,
        ] satisfies Parameters<typeof provider.putObject>;
        const expected = data;
        // #endregion

        // #region When
        const run = () => provider.putObject(...given);
        // #endregion

        // #region Then
        await expect(run()).resolves.toBeUndefined();
        expect(bucket.file).toHaveBeenCalledWith(path);
        expect(file.createWriteStream).toHaveBeenCalledWith(options.metadata);
        expect(getReceived()).toEqual(expected);
        // #endregion
      });
    });

    describe('when data is buffer', () => {
      it('should put an object into the container', async () => {
        // #region Given
        const connection = { rootDir: '/data' };
        const container = '/bucket1';
        const path = 'file1';
        const data = 'data';
        const options = { metadata: {} };

        const provider = new LocalFsProvider(connection);
        const { getReceived, writable } = createDummyWritable();
        const file = createMock<LocalFsFile>({ createWriteStream: jest.fn(() => writable) });
        const bucket = createMock<LocalFsBucket>({
          file: jest.fn().mockResolvedValue(file),
        });
        jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);

        const given = [container, path, Buffer.from(data), options] satisfies Parameters<
          typeof provider.putObject
        >;
        const expected = data;
        // #endregion

        // #region When
        const run = () => provider.putObject(...given);
        // #endregion

        // #region Then
        await expect(run()).resolves.toBeUndefined();
        expect(bucket.file).toHaveBeenCalledWith(path);
        expect(file.createWriteStream).toHaveBeenCalledWith(options.metadata);
        expect(getReceived()).toEqual(expected);
        // #endregion
      });
    });

    describe('when data is string', () => {
      it('should put an object into the container', async () => {
        // #region Given
        const connection = { rootDir: '/data' };
        const container = '/bucket1';
        const path = 'file1';
        const data = 'data';
        const options = { metadata: {} };

        const provider = new LocalFsProvider(connection);
        const { getReceived, writable } = createDummyWritable();
        const file = createMock<LocalFsFile>({ createWriteStream: jest.fn(() => writable) });
        const bucket = createMock<LocalFsBucket>({
          file: jest.fn().mockResolvedValue(file),
        });
        jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);

        const given = [container, path, data, options] satisfies Parameters<
          typeof provider.putObject
        >;
        const expected = data;
        // #endregion

        // #region When
        const run = () => provider.putObject(...given);
        // #endregion

        // #region Then
        await expect(run()).resolves.toBeUndefined();
        expect(bucket.file).toHaveBeenCalledWith(path);
        expect(file.createWriteStream).toHaveBeenCalledWith(options.metadata);
        expect(getReceived()).toEqual(expected);
        // #endregion
      });
    });

    describe('when data is not stream, buffer or string', () => {
      it('should throws', async () => {
        // #region Given
        const connection = { rootDir: '/data' };
        const container = '/bucket1';
        const path = 'file1';
        const data = 1234;
        const options = { metadata: {} };

        const provider = new LocalFsProvider(connection);
        const { getReceived, writable } = createDummyWritable();
        const file = createMock<LocalFsFile>({ createWriteStream: jest.fn(() => writable) });
        const bucket = createMock<LocalFsBucket>({
          file: jest.fn().mockResolvedValue(file),
        });
        jest.mocked(LocalFsClient.prototype.bucket).mockReturnValue(bucket);

        // @ts-expect-error
        const given = [container, path, data, options] satisfies Parameters<
          typeof provider.putObject
        >;
        // #endregion

        // #region When
        // @ts-expect-error
        const run = () => provider.putObject(...given);
        // #endregion

        // #region Then
        await expect(run()).rejects.toThrow();
        expect(bucket.file).toHaveBeenCalledWith(path);
        expect(file.createWriteStream).not.toHaveBeenCalled();
        expect(getReceived()).toEqual('');
        // #endregion
      });
    });
  });

  describe('presignedGetUrl()', () => {
    it('should do nothing', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const path = 'file1';
      const ttl = 3600;
      const provider = new LocalFsProvider(connection);
      const given = [container, path, ttl] satisfies Parameters<typeof provider.presignedGetUrl>;
      // #endregion

      // #region When
      const run = () => provider.presignedGetUrl(...given);
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual('');
      // #endregion
    });
  });

  describe('presignedPutUrl()', () => {
    it('should do nothing', async () => {
      // #region Given
      const connection = { rootDir: '/data' };
      const container = 'bucket1';
      const path = 'file1';
      const options = {};
      const ttl = 3600;
      const provider = new LocalFsProvider(connection);
      const given = [container, path, options, ttl] satisfies Parameters<
        typeof provider.presignedPutUrl
      >;
      // #endregion

      // #region When
      const run = () => provider.presignedPutUrl(...given);
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual('');
      // #endregion
    });
  });
});
