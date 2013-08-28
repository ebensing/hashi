#!/bin/bash


NODE=`which node`

echo "Checking to see if node is installed..."
if [ ! $NODE ]; then
  echo "Installing Node.js"
  sudo apt-get install python-software-properties python g++ make
  sudo add-apt-repository ppa:chris-lea/node.js
  sudo apt-get update
  sudo apt-get install nodejs
  echo "Node.js installed!"
fi

echo "Checking to see if MongoDB is installed..."

MONGO=`which mongod`
if [ ! $MONGO ]; then
  echo "Installing MongoDB"
  sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
  echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list
  sudo apt-get update
  sudo apt-get install mongodb-10gen
  # enable text search
  sudo echo "setParameter=textSearchEnabled=true" >> /etc/mongodb.conf
  sudo service mongodb restart
  echo "MongoDB installed!"
fi


echo "Installing node dependencies..."
npm install

echo "Installing forever..."
sudo npm install forever -g

echo "Setup complete. All dependencies have been installed"
