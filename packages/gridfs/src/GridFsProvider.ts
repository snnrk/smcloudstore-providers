import * as path from 'path';
import { Duplex, Stream } from 'stream';
import {
  ListItemObject,
  ListResults,
  PutObjectOptions,
  StorageProvider,
} from '@smcloudstore/core/dist/StorageProvider';
import { IsStream } from '@smcloudstore/core/dist/StreamUtils';
import {
  GridFsClient,
  GridFsClientOptions,
  GridFsClientPutObjectOptions,
  GridFsObject,
} from './GridFsClient';

interface GridFSCreateContainerOptions extends Record<string, unknown> {}
interface GridFSEnsureContainerOptions extends Record<string, unknown> {}
export interface GridFSPutObjectOptions extends PutObjectOptions {
  metadata?: GridFsClientPutObjectOptions;
}

const makePath = (container: string, filePath: string): string => path.join(container, filePath);

export class GridFsProvider extends StorageProvider {
  protected declare _client: GridFsClient;

  constructor(connection: GridFsClientOptions) {
    super(connection);

    this._provider = 'gridfs';
    this._client = new GridFsClient(connection);
  }

  // #region functions for containers
  async createContainer(_container: string, _options: GridFSCreateContainerOptions): Promise<void> {
    return Promise.resolve();
  }

  async deleteContainer(container: string): Promise<void> {
    const pattern = new RegExp('^' + [container, '*'].join('/'));
    const listItems = await this._client.listObjects(pattern);

    if (listItems.length === 0) {
      return;
    }

    await this._client.connect();
    await Promise.all(listItems.map((item) => this._client.deleteObject(item.filename, false)));
    await this._client.disconnect();
  }

  async ensureContainer(_container: string, _options: GridFSEnsureContainerOptions) {
    return Promise.resolve();
  }

  isContainer(_container: string) {
    return Promise.resolve(true);
  }

  async listContainers(): Promise<string[]> {
    return Promise.resolve([] as string[]);
  }
  // #endregion

  // #region functions for objects
  async getObject(container: string, path: string) {
    const filename = makePath(container, path);
    const stream = await this._client.getObject(filename);

    return stream;
  }

  async putObject(
    container: string,
    path: string,
    data: Buffer | Stream | string,
    options?: GridFSPutObjectOptions
  ): Promise<void> {
    const filename = makePath(container, path);

    if (IsStream(data)) {
      return await this._client.putObject(filename, data as Stream, options.metadata);
    }

    const ds = new Duplex();
    if (typeof data == 'object' && Buffer.isBuffer(data)) {
      ds.push(data);
    } else if (typeof data == 'string') {
      ds.push(data, 'utf8');
    } else {
      throw Error('Invalid data argument: must be a stream, a Buffer or a string');
    }
    ds.push(null);

    return await this._client.putObject(filename, ds, options.metadata);
  }

  async listObjects(container: string, prefix?: string): Promise<ListResults> {
    const paths = [container];
    if (prefix !== undefined) {
      paths.push(prefix);
    }
    const pattern = new RegExp('^' + paths.join('/'));

    const results = await this._client.listObjects(pattern);

    return results.map(
      (obj: GridFsObject): ListItemObject => ({
        contentMD5: obj.md5,
        lastModified: new Date(obj.uploadDate),
        path: obj.filename,
        size: obj.length,
      })
    );
  }

  async deleteObject(container: string, path: string): Promise<void> {
    const filename = makePath(container, path);

    return await this._client.deleteObject(filename);
  }
  // #endregion

  // #region functions for presigned url
  async presignedGetUrl(_container: string, _path: string, _ttl?: number): Promise<string> {
    return Promise.resolve('');
  }

  presignedPutUrl(
    _container: string,
    _path: string,
    _options?: GridFSPutObjectOptions,
    _ttl?: number
  ): Promise<string> {
    return Promise.resolve('');
  }
  // #endregion
}
