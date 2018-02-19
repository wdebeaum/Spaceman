# Spaceman #

Spaceman is a TRIPS module that turns language-derived descriptions of spatial locations (such as names of countries) into descriptions that explicitly specify which points on the Earth's surface are inside or outside those locations, in raster (e.g. GTiff) or vector (e.g. GeoJSON) formats. In some cases it can instead output standard codes (e.g. ISO country codes). It can make use of IMPACT data for names of countries, basins, and food production units (FPUs), and it can make use of ISO data for names of countries. Failing that, it can use [OpenStreetMap](https://www.openstreetmap.org/).

This file is the README for the standalone version of Spaceman. The main documentation in [README.html](README.html) is written in the context of TRIPS. For the standalone version, `$TRIPS_BASE` is `trips/`.

## Build instructions ##

First, install the prerequisites listed in [README.html](README.html). Then build Spaceman itself:

    ./configure [--with-node=/path/to/node] [--with-npm=/path/to/npm]
    make
    make install # installs to trips/etc/ and trips/bin/

## Run instructions ##

For standalone usage, you should give Spaceman the `-connect no` option, to prevent it from trying to connect to the TRIPS Facilitator:

    ./trips/bin/Spaceman -connect no

Then it will accept requests on its standard input stream, and give replies on its standard output stream (in addition to a few startup messages you can ignore). For the details of these requests and replies, see [README.html](README.html).

## Licensing ##

Spaceman is licensed using the [GPL 2+](http://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html) (see `LICENSE.txt`):

Spaceman - resolves geospatial references
Copyright (C) 2018  Institute for Human & Machine Cognition

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
