import {
  createReadStream,
  createWriteStream,
  MakeDirectoryOptions,
  RmDirOptions,
  Stats,
  WriteStream,
} from 'fs';
import type { CreateReadStreamOptions, CreateWriteStreamOptions } from 'fs/promises';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Stream } from 'stream';

export type LocalFsConnectionOptions = {
  rootDir: string;
};
export type LocalFsObjectOptions = {
  name: string;
  parent?: string;
};
export type LocalFsBucketCreateOptions = MakeDirectoryOptions & { recursive?: boolean };
export type LocalFsBucketDeleteOptions = RmDirOptions;
export type LocalFsFileGetOptions = BufferEncoding | CreateReadStreamOptions;
export type LocalFsFilePutOptions = BufferEncoding | CreateWriteStreamOptions;

abstract class LocalFsObject {
  private _base: string;
  public get base() {
    return this._base;
  }
  protected set base(value: string) {
    this._base = value;
  }

  private _name: string;
  public get name() {
    return this._name;
  }
  protected set name(value: string) {
    this._name = value;
  }

  get path(): string {
    return path.join('/', this.base, this.name);
  }

  constructor({ name, parent = '' }: LocalFsObjectOptions) {
    this.base = parent.replace(/(?<!^)\/$/, '');
    this.name = name;
  }

  abstract exists(): Promise<boolean>;
}

export class LocalFsFile extends LocalFsObject {
  createReadStream(options?: LocalFsFileGetOptions): Stream {
    return createReadStream(this.path, options);
  }

  createWriteStream(options?: LocalFsFilePutOptions): WriteStream {
    return createWriteStream(this.path, options);
  }

  async delete(): Promise<void> {
    await fs.unlink(this.path);
  }

  async exists(): Promise<boolean> {
    try {
      const stat = await this.stat();
      return stat.isFile();
    } catch (_error) {
      return false;
    }
  }

  async stat(): Promise<Stats> {
    return await fs.stat(this.path);
  }
}

export class LocalFsBucket extends LocalFsObject {
  async create(options?: LocalFsBucketCreateOptions): Promise<void> {
    await fs.mkdir(this.path, options);
  }

  async delete(options?: LocalFsBucketDeleteOptions): Promise<void> {
    await fs.rmdir(this.path, options);
  }

  async exists(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.path);
      return stat.isDirectory();
    } catch (_error) {
      return false;
    }
  }

  async file(name: string) {
    return new LocalFsFile({ name, parent: this.path });
  }

  async getFiles(): Promise<LocalFsFile[]> {
    const files = await fs.readdir(this.path, { withFileTypes: true });
    return await Promise.all(
      files.reduce((stack, file) => {
        if (file.isFile()) {
          stack.push(this.file(file.name));
        }
        return stack;
      }, [])
    );
  }
}

export class LocalFsClient {
  private rootDir: string;
  constructor(connection: LocalFsConnectionOptions) {
    this.rootDir = connection.rootDir;
  }

  bucket(name: string) {
    return new LocalFsBucket({ name, parent: this.rootDir });
  }

  async getBuckets() {
    const dirs = await fs.readdir(this.rootDir, { withFileTypes: true });
    return dirs.reduce<LocalFsBucket[]>((stack, dir) => {
      if (dir.isDirectory()) {
        stack.push(this.bucket(dir.name));
      }
      return stack;
    }, []);
  }
}
