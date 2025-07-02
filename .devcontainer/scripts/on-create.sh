## install mongodb
source ${CONTAINER_WORKSPACE_FOLDER}/.devcontainer/env/mongodb.sh
curl -O https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-${MONGODB_VERSION}.tgz
sudo mkdir -p ${MONGODB_INSTALL_DIR} ${MONTODB_DATA_DIR}
sudo tar -zxvf mongodb-linux-x86_64-${MONGODB_VERSION}.tgz -C ${MONGODB_INSTALL_DIR} --strip-components=1
rm -rf mongodb-linux-x86_64-${MONGODB_VERSION}.tgz

## install tsx
sudo npm i -g tsx

## change ownership of node_modules
sudo chown -R node:node ${CONTAINER_WORKSPACE_FOLDER}/node_modules

## install dependencies
[ -f package-lock.json ] && npm clean-install
