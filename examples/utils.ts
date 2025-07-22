import SMCloudStoreOrig from 'smcloudstore';

export const SMCloudStore: typeof SMCloudStoreOrig = {
  Create(provider: string, connection: any) {
    if (provider === 'localfs' || provider === 'gridfs') {
      if (!connection) {
        throw Error('The connection argument must be non-empty');
      }

      const providerModule = require(`@snnrk/smcloudstore-${provider}`).default;

      return new providerModule(connection);
    } else {
      return SMCloudStoreOrig.Create(provider, connection);
    }
  },
  Providers() {
    const providers = SMCloudStoreOrig.Providers();
    providers.push('localfs');
    providers.push('gridfs');

    return providers;
  },
};
