/* eslint-disable require-jsdoc */
import { WriteStream } from 'fs';
import { Duplex, Stream } from 'stream';
import {
  ListItemObject,
  ListResults,
  PutObjectOptions,
  StorageProvider,
} from '@smcloudstore/core/dist/StorageProvider';
import { IsStream } from '@smcloudstore/core/dist/StreamUtils';
import {
  LocalFsBucketCreateOptions,
  LocalFsClient,
  LocalFsConnectionOptions,
  LocalFsFilePutOptions,
} from './LocalFsClient';

export interface LocalFsPutObjectOptions extends PutObjectOptions {
  metadata?: LocalFsFilePutOptions;
}

export class LocalFsProvider extends StorageProvider {
  protected declare _client: LocalFsClient;

  constructor(connection: LocalFsConnectionOptions) {
    super(connection);

    this._provider = 'local-fs';
    this._client = new LocalFsClient(connection);
  }

  // #region functions for containers
  async createContainer(container: string, options?: LocalFsBucketCreateOptions): Promise<void> {
    const bucket = this._client.bucket(container);
    await bucket.create(options);
  }

  async deleteContainer(container: string): Promise<void> {
    const bucket = this._client.bucket(container);
    await bucket.delete();
  }

  async ensureContainer(container: string, options?: LocalFsBucketCreateOptions): Promise<void> {
    if (!(await this.isContainer(container))) {
      await this.createContainer(container, options);
    }
  }

  async isContainer(container: string): Promise<boolean> {
    const bucket = this._client.bucket(container);
    return await bucket.exists();
  }

  async listContainers(): Promise<string[]> {
    const buckets = await this._client.getBuckets();
    return buckets.map((bucket) => bucket.path);
  }
  // #endregion

  // #region functions for objects
  async deleteObject(container: string, path: string): Promise<void> {
    const bucket = this._client.bucket(container);
    const file = await bucket.file(path);

    await file.delete();
  }

  async getObject(container: string, path: string): Promise<Stream> {
    const bucket = this._client.bucket(container);
    const file = await bucket.file(path);

    return file.createReadStream();
  }

  async listObjects(container: string, _prefix?: string): Promise<ListResults> {
    const results = [] satisfies ListResults;
    const bucket = this._client.bucket(container);
    const files = await bucket.getFiles();

    for (const file of files) {
      const stat = await file.stat();
      results.push({
        path: file.name,
        size: stat.size,
        lastModified: stat.mtime,
        creationTime: stat.birthtime,
      } satisfies ListItemObject);
    }

    return results;
  }

  async putObject(
    container: string,
    path: string,
    data: Buffer | Stream | string,
    options: LocalFsPutObjectOptions = {}
  ): Promise<void> {
    const { metadata: createWriteStreamOption } = options;
    const bucket = this._client.bucket(container);
    const file = await bucket.file(path);

    let src: Stream;
    // eslint-disable-next-line new-cap
    if (IsStream(data)) {
      src = data as Stream;
    } else {
      src = new Duplex();
      // Buffers
      if (typeof data == 'object' && Buffer.isBuffer(data)) {
        (src as Duplex).push(data);
      } else if (typeof data == 'string') {
        (src as Duplex).push(data, 'utf8');
      } else {
        throw Error('Invalid data argument: must be a stream, a Buffer or a string');
      }
      (src as Duplex).push(null);
    }

    const dst = file.createWriteStream(createWriteStreamOption);

    return new Promise((resolve, reject) => {
      src
        .pipe<WriteStream>(dst)
        .on('error', reject)
        .on('finish', () => resolve());
    });
  }
  // #endregion

  // #region functions for presigned url
  async presignedGetUrl(_container: string, _path: string, _ttl?: number): Promise<string> {
    return Promise.resolve('');
  }

  async presignedPutUrl(
    _container: string,
    _path: string,
    _options?: LocalFsPutObjectOptions,
    _ttl?: number
  ): Promise<string> {
    return Promise.resolve('');
  }
  // #endregion
}
