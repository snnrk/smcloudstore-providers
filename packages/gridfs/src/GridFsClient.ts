import {
  GridFSBucket,
  GridFSBucketOpenUploadStreamOptions,
  GridFSBucketOptions,
  GridFSBucketReadStream,
  MongoClient,
  MongoClientOptions,
  ObjectID,
} from 'mongodb';
import { Readable, Stream } from 'stream';
import { pipeline } from 'stream/promises';

export interface GridFsClientOptions {
  database: string;
  options?: MongoClientOptions;
  servers: string[];
}

export interface GridFsObject {
  _id: ObjectID;
  length: number;
  chunkSize: number;
  uploadDate: string;
  filename: string;
  md5: string;
}

export interface GridFsClientPutObjectOptions {
  replace?: boolean;
  streamOptions?: GridFSBucketOpenUploadStreamOptions;
}

const isEmpty = (value: string | number | boolean | null | undefined) =>
  value === '' || value === null || value === undefined || Number.isNaN(value);

export class MongoURI {
  auth: Map<'password' | 'user', string>;
  database: string;
  options: Map<string, boolean | number | string>;
  servers: Set<string>;

  constructor() {
    this.auth = new Map<'password' | 'user', string>();
    this.database = 'fs';
    this.options = new Map<string, string>();
    this.servers = new Set<string>();
  }

  toString(): string {
    const buffer = ['mongodb://'];

    if (this.auth.has('user') && this.auth.has('password')) {
      const authString = [this.auth.get('user'), this.auth.get('password')].join(':');
      buffer.push(authString);
      buffer.push('@');
    }

    if (this.servers.size > 0) {
      const servers: string[] = [];

      for (const server of this.servers) {
        servers.push(server);
      }

      buffer.push(servers.join(','));
    }

    buffer.push('/', this.database);

    const queryParams = Array.from(this.options.entries())
      .reduce((stack, [key, value]) => {
        if (!isEmpty(value)) {
          stack.push(`${key}=${value}`);
        }
        return stack;
      }, [])
      .join('&');

    if (!isEmpty(queryParams)) {
      buffer.push('?', queryParams);
    }

    return buffer.join('');
  }

  static parse(params: GridFsClientOptions) {
    const instance = new this();

    instance.database = params.database;

    if (params.options !== undefined) {
      const { auth, ...rest } = params.options;
      if (auth !== undefined) {
        instance.auth.set('user', auth.user);
        instance.auth.set('password', auth.password);
      }
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          instance.options.set(key, value.toString());
        }
      }
    }

    if (params.servers !== undefined && params.servers.length > 0) {
      for (const server of params.servers) {
        instance.servers.add(server);
      }
    }

    return instance;
  }
}

export class GridFsClient {
  private _conn: MongoClient | undefined;
  private _uri: string;

  constructor(private _params: GridFsClientOptions) {
    const uri = MongoURI.parse(this._params);
    this._uri = uri.toString();
  }

  async connect() {
    if (this._conn === undefined) {
      this._conn = await MongoClient.connect(this._uri, this._params.options);
    }
  }

  async disconnect() {
    if (this._conn !== undefined) {
      await this._conn.close();
      this._conn = undefined;
    }
  }

  async getBucket(options?: GridFSBucketOptions) {
    const db = this._conn?.db(this._params.database);
    return new GridFSBucket(db, options);
  }

  // #region functions for objects

  async deleteObject(filename: string, shouldBeDispose: boolean = true): Promise<void> {
    await this.connect();
    const bucket = await this.getBucket();
    const objects = await bucket.find({ filename }).limit(1).toArray();

    if (objects.length === 0) {
      if (shouldBeDispose) {
        await this.disconnect();
      }

      throw new Error(`Object not found: ${filename}`);
    }

    const [obj] = objects;

    return new Promise((resolve, reject) => {
      bucket.delete(obj._id, (error) => {
        const fin = () => {
          if (error) {
            return reject(error);
          } else {
            return resolve(void 0);
          }
        };

        if (shouldBeDispose) {
          this.disconnect().then(fin).catch(reject);
        } else {
          fin();
        }
      });
    });
  }

  async getObject(filename: string): Promise<GridFSBucketReadStream> {
    await this.connect();
    const bucket = await this.getBucket();
    const objects = await bucket.find({ filename }).limit(1).toArray();

    if (objects.length === 0) {
      await this.disconnect();
      return null;
    }

    const [obj] = objects;
    const stream = bucket.openDownloadStream(obj._id);

    stream.on('close', async () => {
      // this.disconnect().catch((error) => {
      //   throw new Error(`Error disconnecting from GridFS: ${error.message}`);
      // });
      await this.disconnect();
    });

    return stream;
  }

  async listObjects(pattern: RegExp): Promise<GridFsObject[]> {
    await this.connect();
    const bucket = await this.getBucket();
    const results = await bucket.find({ filename: { $regex: pattern } }).toArray();
    await this.disconnect();

    return results;
  }

  async putObject(filename: string, data: Stream, options?: GridFsClientPutObjectOptions) {
    await this.connect();
    const bucket = await this.getBucket();

    if (options?.replace === true) {
      try {
        await this.deleteObject(filename, false);
      } catch (_error) {
        // nothing to do
      }
    }

    const dst = bucket.openUploadStream(filename, options?.streamOptions);

    const src = new Readable({
      read() {},
    });

    data
      .on('data', (chunk) => {
        src.push(chunk);
      })
      .on('end', () => {
        src.push(null);
      });

    try {
      await pipeline(src, dst);
    } finally {
      await this.disconnect();
    }
  }
  // #endregion
}
