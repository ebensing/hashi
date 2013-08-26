#!/bin/bash

LOGPATH=$(pwd)

mkdir -p ./logs/

# make sure we have a github user name
if [ ${githubUsername:+x} ] ; then
  :
else
  echo "Please enter your Github username:"
  read username
  export githubUsername=$username
fi

# get the password
if [ ${githubPassword:+x} ] ; then
  :
else
  echo "Please enter your Github password:"
  read -s password
  export githubPassword=$password
fi

# get the asana api key
if [ ${asanaKey:+x} ] ; then
  :
else
  echo "Please input your Asana API key:"
  read apiKey
  export asanaKey=$apiKey
fi

# start the daemon
forever start -a \
  -l $LOGPATH/logs/forever.log \
  -o $LOGPATH/logs/out.log \
  -e $LOGPATH/logs/err.log \
  app.js
