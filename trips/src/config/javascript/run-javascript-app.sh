#!/bin/sh
#
# run-javascript-app.sh: Shell script wrapper for launching a Javascript app
#
# William de Beaumont, wbeaumont@ihmc.us, 2015-04-03
# $Id: run-javascript-app.sh,v 1.2 2015/12/11 19:01:13 wdebeaum Exp $
#
# This file will be customized for a specific application by setting
# the variables at the top of the file. If this file's name is not
# "run-javascript-app.sh", then you are looking at such a customization.
#

# Variables set by component Makefile
MODULE=ModuleName
MAIN=main.js

# Root of TRIPS installation
TRIPS_BASE_DEFAULT=.
if test -z "$TRIPS_BASE"; then
    TRIPS_BASE=$TRIPS_BASE_DEFAULT
    export TRIPS_BASE
fi

# interpreter
if test -z "$NODE"; then
    NODE=/usr/bin/node
fi

etcdir="$TRIPS_BASE/etc"
moduledir="$etcdir/$MODULE"

# Run Node
export NODE_PATH="$moduledir":"$etcdir"
exec $NODE "$moduledir/$MAIN" "$@"
