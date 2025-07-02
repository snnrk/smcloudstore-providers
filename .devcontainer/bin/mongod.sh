#!/usr/bin/env bash

source $(dirname $0)/../env/mongodb.sh

case $1 in
  start)
    echo "Starting MongoDB..."
    mongod --auth --dbpath ${MONTODB_DATA_DIR} --logpath ${MONGODB_LOG_DIR}/mongodb.log --fork
    ;;
  stop)
    echo "Stopping MongoDB..."
    mongo admin --eval "db.shutdownServer()"
    ;;
  restart)
    echo "Restarting MongoDB..."
    $0 stop
    $0 start
    ;;
  status)
    if pgrep -x "mongod" > /dev/null; then
      echo "MongoDB is running."
    else
      echo "MongoDB is not running."
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
esac
