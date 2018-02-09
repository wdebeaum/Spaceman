# Spaceman #

Spaceman is a TRIPS module that turns language-derived descriptions of spatial locations (such as names of countries) into descriptions that explicitly specify which points on the Earth's surface are inside or outside those locations, in raster (e.g. GTiff) or vector (e.g. GeoJSON) formats. In some cases it can instead output standard codes (e.g. ISO country codes). It can make use of IMPACT data for names of countries, basins, and food production units (FPUs), and it can make use of ISO data for names of countries. Failing that, it can use [OpenStreetMap](https://www.openstreetmap.org/).

The main documentation is in [README.html](README.html), please read the list of prerequisites there.

## Build instructions ##

    ./configure
    make
    make install # installs to trips/etc/

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
