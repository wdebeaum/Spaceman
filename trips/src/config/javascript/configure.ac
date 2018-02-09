#
# configure.ac for javascript
#
# William de Beaumont, wbeaumont@ihmc.us, 2015-04-03
# $Id: configure.ac,v 1.1 2015/04/03 15:46:06 wdebeaum Exp $
#
# Process this file with autoconf to produce a configure script.
#

AC_INIT(TRIPS-config-javascript, 2015-04-03, wbeaumont@ihmc.us)
AC_CONFIG_SRCDIR([defs.mk.in])
AC_CONFIG_AUX_DIR([../auto])

AC_ARG_WITH(node,
	    AC_HELP_STRING([--with-node],
			   [specify node.js JavaScript interpreter (default "node")]),
	    AC_SUBST(NODE, $withval),
	    AC_CHECK_PROGS(NODE, node iojs, node))

AC_ARG_WITH(npm,
	    AC_HELP_STRING([--with-npm],
	    		   [specify Node Package Manager (default "npm")]),
	    AC_SUBST(NPM, $withval),
	    AC_CHECK_PROGS(NPM, npm, npm))

AC_CONFIG_FILES([Makefile defs.mk])
AC_OUTPUT

