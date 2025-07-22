import { StorageProvider } from '@smcloudstore/core/dist/StorageProvider';
import { Readable } from 'stream';
import { SMCloudStore } from './utils';

const container = '.';
const filename = 'test1.txt';

const connection = {
  rootDir: '/tmp',
};

const deleteObject = async (provider: StorageProvider) => {
  await provider.deleteObject(container, filename);
};

const getObject = async (provider: StorageProvider) => {
  const stream = (await provider.getObject(container, filename)) as Readable;

  const data = await new Promise<string>((resolve, reject) => {
    const buffer: Uint8Array[] = [];

    stream
      .on('data', (chunk: Buffer) => {
        buffer.push(Uint8Array.from(chunk));
      })
      .on('error', (error) => {
        reject(error);
      })
      .on('end', () => {
        resolve(Buffer.concat(buffer).toString('utf8'));
      });
  });

  console.log('getObject', { data });
};

const listObjects = async (provider: StorageProvider) => {
  const objects = await provider.listObjects(container);
  console.log('listObjects', objects);
};

const putObject = async (provider: StorageProvider) => {
  const data = 'Hello, World!';
  await provider.putObject(container, filename, data);
};

async function main() {
  try {
    const provider = SMCloudStore.Create('localfs', connection);

    await putObject(provider);
    await listObjects(provider);
    await getObject(provider);
    await deleteObject(provider);
    await listObjects(provider);
  } catch (error) {
    console.error({ error });
  }
}

main().catch((error) => {
  console.error('Error in main:', error);
  process.exit(1);
});
