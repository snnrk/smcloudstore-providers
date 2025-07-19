import { vol } from 'memfs';
import { LocalFsBucket, LocalFsClient, LocalFsFile } from '../packages/localfs/src/LocalFsClient';
import { writeToStream } from './helper';
import { StreamToBuffer } from '@smcloudstore/core/dist/StreamUtils';

jest.mock('fs', () => jest.requireActual('memfs').fs);
jest.mock('fs/promises', () => jest.requireActual('memfs').promises);

const isExists = async (path: string) => vol.promises.stat(path);

const db = {
  bucket1: {
    file1: 'file1 content',
    file2: 'file2 content',
  },
  bucket2: {
    file3: 'file3 content',
  },
  bucket3: {},
};

describe('LocalFsFile', () => {
  beforeEach(() => {
    vol.fromNestedJSON(db, '/data');
  });

  afterEach(() => {
    vol.reset();
    jest.resetAllMocks();
  });

  it('should create a new instance for exist file', async () => {
    // #region Given
    const given = { name: 'file1', parent: '/data/bucket1' };
    const expected = `${given.parent}/${given.name}`;
    // #endregion

    // #region When
    const run = () =>
      new Promise((resolve, reject) => {
        try {
          resolve(new LocalFsFile(given));
        } catch (error) {
          reject(error);
        }
      });
    // #endregion

    // #region Then
    await expect(isExists(expected)).resolves.toBeDefined();
    await expect(run()).resolves.toHaveProperty('path', expected);
    // #endregion
  });

  it('should create a new instance for non-exist file', async () => {
    // #region Given
    const given = { name: 'file0', parent: '/data/bucket1' };
    const expected = `${given.parent}/${given.name}`;
    // #endregion

    // #region When
    const run = () =>
      new Promise((resolve, reject) => {
        try {
          resolve(new LocalFsFile(given));
        } catch (error) {
          reject(error);
        }
      });
    // #endregion

    // #region Then
    await expect(isExists(expected)).rejects.toThrow();
    await expect(run()).resolves.toHaveProperty('path', expected);
    // #endregion
  });

  describe('createReadStream()', () => {
    it('should return a readable stream', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const options = undefined;
      const content = await vol.promises.readFile(filename, options);
      const expected = content.toString();
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = async () => {
        const rs = file.createReadStream(options);
        const buffer = await StreamToBuffer(rs);
        return buffer.toString();
      };
      // #endregion

      // #region Then
      await expect(isExists(filename)).resolves.toBeDefined();
      await expect(run()).resolves.toEqual(expected);
      // #endregion
    });

    it('should return a readable stream with options', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const options = 'utf-8';
      const content = await vol.promises.readFile(filename, options);
      const expected = content.toString();
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = async () => {
        const rs = file.createReadStream(options);
        const buffer = await StreamToBuffer(rs);
        return buffer.toString();
      };
      // #endregion

      // #region Then
      await expect(isExists(filename)).resolves.toBeDefined();
      await expect(run()).resolves.toEqual(expected);
      // #endregion
    });
  });

  describe('createWriteStream()', () => {
    it('should return a writable stream', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const options = undefined;
      const expected = 'overwrote file1 content';
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = async () => {
        const ws = file.createWriteStream(options);
        await writeToStream(ws, expected);
      };
      // #endregion

      // #region Then
      await expect(isExists(filename)).resolves.toBeDefined();
      await expect(run()).resolves.toBeUndefined();
      await expect(vol.promises.readFile(filename, 'utf-8')).resolves.toEqual(expected);
      // #endregion
    });

    it('should return a writable stream with options', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const options = 'utf-8';
      const expected = 'overwrote file1 content';
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = async () => {
        const ws = file.createWriteStream(options);
        await writeToStream(ws, expected);
      };
      // #endregion

      // #region Then
      await expect(isExists(filename)).resolves.toBeDefined();
      await expect(run()).resolves.toBeUndefined();
      await expect(vol.promises.readFile(filename, 'utf-8')).resolves.toEqual(expected);
      // #endregion
    });
  });

  describe('delete()', () => {
    it('should resolve for exist file', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.delete();
      // #endregion

      // #region Then
      await expect(isExists(filename)).resolves.toBeDefined();
      await expect(run()).resolves.toBeUndefined();
      await expect(isExists(filename)).rejects.toThrow();
      // #endregion
    });

    it('should reject for non-exist file', async () => {
      // #region Given
      const given = { name: 'file0', parent: '/data/bucket1' };
      const filename = `${given.parent}/${given.name}`;
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.delete();
      // #endregion

      // #region Then
      await expect(isExists(filename)).rejects.toThrow();
      await expect(run()).rejects.toThrow();
      await expect(isExists(filename)).rejects.toThrow();
      // #endregion
    });
  });

  describe('exists()', () => {
    it('should return true if the file exists', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.exists();
      // #endregion

      // #region Then
      await expect(isExists(`${given.parent}/${given.name}`)).resolves.toBeDefined();
      await expect(run()).resolves.toBeTruthy();
      // #endregion
    });

    it('should return false if the file does not exist', async () => {
      // #region Given
      const given = { name: 'file0', parent: '/data/bucket1' };
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.exists();
      // #endregion

      // #region Then
      await expect(isExists(`${given.parent}/${given.name}`)).rejects.toThrow();
      await expect(run()).resolves.toBeFalsy();
      // #endregion
    });

    it('should return false if path points to directory', async () => {
      // #region Given
      const given = { name: 'bucket1', parent: '/data' };
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.exists();
      // #endregion

      // #region Then
      await expect(isExists(`${given.parent}/${given.name}`)).resolves.toBeDefined();
      await expect(run()).resolves.toBeFalsy();
      // #endregion
    });
  });

  describe('stat()', () => {
    it('should return the file stats', async () => {
      // #region Given
      const given = { name: 'file1', parent: '/data/bucket1' };
      const expected = await isExists(`${given.parent}/${given.name}`);
      const file = new LocalFsFile(given);
      // #endregion

      // #region When
      const run = () => file.stat();
      // #endregion

      // #region Then
      await expect(isExists(`${given.parent}/${given.name}`)).resolves.toBeDefined();
      await expect(run()).resolves.toEqual(expected);
      // #endregion
    });
  });
});

describe('LocalFsBucket', () => {
  beforeEach(() => {
    vol.fromNestedJSON(db, '/data');
  });

  afterEach(() => {
    vol.reset();
    jest.resetAllMocks();
  });

  it('should create a new instance for non-exist directory', async () => {
    // #region Given
    const given = { name: 'bucket0', parent: '/data' };
    const expected = `${given.parent}/${given.name}`;
    // #endregion

    // #region When
    const run = () =>
      new Promise((resolve, reject) => {
        try {
          resolve(new LocalFsBucket(given));
        } catch (error) {
          reject(error);
        }
      });
    // #endregion

    // #region Then
    await expect(isExists(expected)).rejects.toThrow();
    await expect(run()).resolves.toHaveProperty('path', expected);
    // #endregion
  });

  it('should create a new instance for exist directory', async () => {
    // #region Given
    const given = { name: 'bucket1', parent: '/data' };
    const expected = `${given.parent}/${given.name}`;
    // #endregion

    // #region When
    const run = () =>
      new Promise((resolve, reject) => {
        try {
          resolve(new LocalFsBucket(given));
        } catch (error) {
          reject(error);
        }
      });
    // #endregion

    // #region Then
    await expect(isExists(expected)).resolves.toBeDefined();
    await expect(run()).resolves.toHaveProperty('path', expected);
    // #endregion
  });

  describe('create()', () => {
    it('should create a new directory for non-exist path', async () => {
      // #region Given
      const given = { name: 'bucket0', parent: '/data' };
      const expected = `${given.parent}/${given.name}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.create();
      // #endregion

      // #region Then
      await expect(isExists(expected)).rejects.toThrow();
      await expect(run()).resolves.toBeUndefined();
      await expect(isExists(expected)).resolves.toBeDefined();
      // #endregion
    });

    it('should throw for exist path', async () => {
      // #region Given
      const given = { name: 'bucket1', parent: '/data' };
      const expected = `${given.parent}/${given.name}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.create();
      // #endregion

      // #region Then
      await expect(isExists(expected)).resolves.toBeDefined();
      await expect(run()).rejects.toThrow();
      await expect(isExists(expected)).resolves.toBeDefined();
      // #endregion
    });
  });

  describe('delete()', () => {
    describe('with options', () => {
      describe('of recursive', () => {
        const options = { recursive: true };

        it('should throw for non-exist directory', async () => {
          // #region Given
          const given = { name: 'bucket0', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).rejects.toThrow();
          await expect(run()).rejects.toThrow();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });

        it('should throw for exist directory has files', async () => {
          // #region Given
          const given = { name: 'bucket1', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).resolves.toBeDefined();
          await expect(run()).resolves.toBeUndefined();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });

        it('should delete exist directory has no files', async () => {
          // #region Given
          const given = { name: 'bucket3', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).resolves.toBeDefined();
          await expect(run()).resolves.toBeUndefined();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });
      });

      describe('of force and recursive', () => {
        const options = { force: true, recursive: true };

        it('should throw for non-exist directory', async () => {
          // #region Given
          const given = { name: 'bucket0', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).rejects.toThrow();
          await expect(run()).rejects.toThrow();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });

        it('should delete exist directory has files', async () => {
          // #region Given
          const given = { name: 'bucket1', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).resolves.toBeDefined();
          await expect(run()).resolves.toBeUndefined();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });

        it('should delete exist directory has no files', async () => {
          // #region Given
          const given = { name: 'bucket3', parent: '/data' };
          const expected = `${given.parent}/${given.name}`;
          const bucket = new LocalFsBucket(given);
          // #endregion

          // #region When
          const run = () => bucket.delete(options);
          // #endregion

          // #region Then
          await expect(isExists(expected)).resolves.toBeDefined();
          await expect(run()).resolves.toBeUndefined();
          await expect(isExists(expected)).rejects.toThrow();
          // #endregion
        });
      });
    });

    describe('without options', () => {
      it('should throw for non-exist directory', async () => {
        // #region Given
        const given = { name: 'bucket0', parent: '/data' };
        const expected = `${given.parent}/${given.name}`;
        const bucket = new LocalFsBucket(given);
        // #endregion

        // #region When
        const run = () => bucket.delete();
        // #endregion

        // #region Then
        await expect(isExists(expected)).rejects.toThrow();
        await expect(run()).rejects.toThrow();
        await expect(isExists(expected)).rejects.toThrow();
        // #endregion
      });

      it('should throw for exist directory has files', async () => {
        // #region Given
        const given = { name: 'bucket1', parent: '/data' };
        const expected = `${given.parent}/${given.name}`;
        const bucket = new LocalFsBucket(given);
        // #endregion

        // #region When
        const run = () => bucket.delete();
        // #endregion

        // #region Then
        await expect(isExists(expected)).resolves.toBeDefined();
        await expect(run()).rejects.toThrow();
        await expect(isExists(expected)).resolves.toBeDefined();
        // #endregion
      });

      it('should delete exist directory has no files', async () => {
        // #region Given
        const given = { name: 'bucket3', parent: '/data' };
        const expected = `${given.parent}/${given.name}`;
        const bucket = new LocalFsBucket(given);
        // #endregion

        // #region When
        const run = () => bucket.delete();
        // #endregion

        // #region Then
        await expect(isExists(expected)).resolves.toBeDefined();
        await expect(run()).resolves.toBeUndefined();
        await expect(isExists(expected)).rejects.toThrow();
        // #endregion
      });
    });
  });

  describe('exists()', () => {
    it('should return false if the directory does not exist', async () => {
      // #region Given
      const given = { name: 'bucket0', parent: '/data' };
      const expected = `${given.parent}/${given.name}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.exists();
      // #endregion

      // #region Then
      await expect(isExists(expected)).rejects.toThrow();
      await expect(run()).resolves.toBeFalsy();
      // #endregion
    });

    it('should return true if the directory exists', async () => {
      // #region Given
      const given = { name: 'bucket1', parent: '/data' };
      const expected = `${given.parent}/${given.name}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.exists();
      // #endregion

      // #region Then
      await expect(isExists(expected)).resolves.toBeDefined();
      await expect(run()).resolves.toBeTruthy();
      // #endregion
    });
  });

  describe('file()', () => {
    it('should return a LocalFsFile instance if directory not exist', async () => {
      // #region Given
      const given = { name: 'bucket0', parent: '/data' };
      const dirname = `${given.parent}/${given.name}`;
      const filename = 'fileX';
      const expected = `${dirname}/${filename}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () =>
        new Promise((resolve, reject) => {
          try {
            resolve(bucket.file(filename));
          } catch (error) {
            reject(error);
          }
        });
      // #endregion

      // #region Then
      await expect(isExists(dirname)).rejects.toThrow();
      await expect(run()).resolves.toHaveProperty('path', expected);
      // #endregion
    });

    it('should return a LocalFsFile instance if directory exists', async () => {
      // #region Given
      const given = { name: 'bucket1', parent: '/data' };
      const dirname = `${given.parent}/${given.name}`;
      const filename = 'fileX';
      const expected = `${dirname}/${filename}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () =>
        new Promise((resolve, reject) => {
          try {
            resolve(bucket.file(filename));
          } catch (error) {
            reject(error);
          }
        });
      // #endregion

      // #region Then
      await expect(isExists(dirname)).resolves.toBeDefined();
      await expect(run()).resolves.toHaveProperty('path', expected);
      // #endregion
    });
  });

  describe('getFiles()', () => {
    it('should return a LocalFsFile instances if directory not exist', async () => {
      // #region Given
      const given = { name: 'bucket0', parent: '/data' };
      const dirname = `${given.parent}/${given.name}`;
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.getFiles();
      // #endregion

      // #region Then
      await expect(isExists(dirname)).rejects.toThrow();
      await expect(run()).rejects.toThrow();
      // #endregion
    });

    it('should return a LocalFsFile instances if directory exists', async () => {
      // #region Given
      const given = { name: 'bucket1', parent: '/data' };
      const dirname = `${given.parent}/${given.name}`;
      const expected = Object.keys(db[given.name]).map(
        (name) => new LocalFsFile({ name, parent: dirname })
      );
      const bucket = new LocalFsBucket(given);
      // #endregion

      // #region When
      const run = () => bucket.getFiles();
      // #endregion

      // #region Then
      await expect(isExists(dirname)).resolves.toBeDefined();
      await expect(run()).resolves.toEqual(expected);
      // #endregion
    });
  });
});

describe('LocalFsClient', () => {
  beforeEach(() => {
    vol.fromNestedJSON(db, '/data');
  });

  afterEach(() => {
    vol.reset();
    jest.resetAllMocks();
  });

  describe('bucket()', () => {
    it('should return a LocalFsBucket instance if directory exists', async () => {
      // #region Given
      const given = { rootDir: '/data' };
      // #endregion

      // #region When
      const run = () =>
        new Promise((resolve, reject) => {
          try {
            resolve(new LocalFsClient(given));
          } catch (error) {
            reject(error);
          }
        });
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeInstanceOf(LocalFsClient);
      // #endregion
    });

    it('should return a LocalFsBucket instance if directory not exists', async () => {
      // #region Given
      const given = { rootDir: '/dataX' };
      // #endregion

      // #region When
      const run = () =>
        new Promise((resolve, reject) => {
          try {
            resolve(new LocalFsClient(given));
          } catch (error) {
            reject(error);
          }
        });
      // #endregion

      // #region Then
      await expect(run()).resolves.toBeInstanceOf(LocalFsClient);
      // #endregion
    });
  });

  describe('getBuckets()', () => {
    it('should return an array of LocalFsBucket instances if directory exists', async () => {
      // #region Given
      const given = { rootDir: '/data' };
      const client = new LocalFsClient(given);
      const expected = Object.keys(db).map(
        (name) => new LocalFsBucket({ name, parent: given.rootDir })
      );
      // #endregion

      // #region When
      const run = () => client.getBuckets();
      // #endregion

      // #region Then
      await expect(run()).resolves.toEqual(expected);
      // #endregion
    });

    it('should throw if directory not exists', async () => {
      // #region Given
      const given = { rootDir: '/dataX' };
      const client = new LocalFsClient(given);
      // #endregion

      // #region When
      const run = () => client.getBuckets();
      // #endregion

      // #region Then
      await expect(run()).rejects.toThrow();
      // #endregion
    });
  });
});
