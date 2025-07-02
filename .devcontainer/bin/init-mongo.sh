#!/usr/bin/env bash
source $(dirname $0)/../env/mongodb.sh

MONGO_HOST=127.0.0.1:27017
ADMIN_USER='dbadm'
ADMIN_PWD='dbadm'
OP_USER='user'
OP_PWD='password'

MONGO_AUTH_SOURCE=admin
MONGO_DOC_DB=docs

MONGO_ADMIN_URI=${MONGO_HOST}/${MONGO_AUTH_SOURCE}
MONGO_ADMIN_AUTH_OPTS="-u""${ADMIN_USER}"" -p""${ADMIN_PWD}"" --authenticationDatabase ${MONGO_AUTH_SOURCE} --quiet"

echo 'db.createUser({
  user: "'${ADMIN_USER}'",
  pwd: "'${ADMIN_PWD}'",
  roles: [
    {
      role: "root",
      db: "'${MONGO_AUTH_SOURCE}'"
    }
  ]
})' | mongo ${MONGO_ADMIN_URI}

echo 'db.createUser({
  user: "'${OP_USER}'",
  pwd: "'${OP_PWD}'",
  roles: [
    {
      role: "readWrite",
      db: "'${MONGO_DOC_DB}'"
    }
  ]
})' | mongo ${MONGO_ADMIN_URI} ${MONGO_ADMIN_AUTH_OPTS}

echo 'db.system.users.find({ db: "'${MONGO_DOC_DB}'" })' | mongo ${MONGO_ADMIN_URI} ${MONGO_ADMIN_AUTH_OPTS}
