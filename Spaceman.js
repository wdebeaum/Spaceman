'use strict';

const util = require('util');
const https = require('https');
const fs = require('fs');
const child_process = require('child_process');
const querystring = require('querystring');

const KQML = require('KQML/kqml.js');
const CWCModule = require('util/cwc/cwc-module.js');
const errors = require('util/cwc/errors.js');
const SetOps = require('set-ops.js');

const installDir = process.env.TRIPS_BASE + '/etc/Spaceman';
const cacheDirParent = `${installDir}/cache/`;

// From "The International Model for Policy Analysis of Agricultural
// Commodities and Trade (IMPACT): Model Description for Version 3", Appendix
// A, Table A.1.
// NOTE: Only the 1:n codes are represented here; 1:1 codes are assumed to be
// the same for ISO and IMPACT.
const impactMergers = [
  { impactCode: 'BLT', impactName: 'Baltic States',
    isoCodes: ['EST', 'LTU', 'LVA'] },
  { impactCode: 'BLX', impactName: 'Belgium-Luxembourg',
    isoCodes: ['BEL', 'LUX'] },
  { impactCode: 'CHM', impactName: 'China Plus',
    isoCodes: ['CHN', 'HKG', 'MAC', 'TWN'] },
  { impactCode: 'CHP', impactName: 'Switzerland Plus',
    isoCodes: ['CHE', 'LIE'] },
  { impactCode: 'CRB', impactName: 'Other Caribbean',
    isoCodes: 'ABW AIA ANT ATG BES BHS BLM BRB CUW CYM CMA GLP GRD KNA LCA MAF MSR MTQ PRI SXM TCA TTO VCT VGB VIR'.split(' ') },
  { impactCode: 'FNP', impactName: 'Finland Plus',
    isoCodes: ['ALA', 'FIN'] },
  { impactCode: 'FRP', impactName: 'France Plus',
    isoCodes: ['FRA', 'MCO'] },
  { impactCode: 'GSA', impactName: 'Guyanas South America',
    isoCodes: ['GUF', 'GUY', 'SUR'] },
  { impactCode: 'ITP', impactName: 'Italy Plus',
    isoCodes: ['ITA', 'MLT', 'SMR', 'VAT'] },
  { impactCode: 'MOR', impactName: 'Morocco Plus',
    isoCodes: ['ESH', 'MAR'] },
  { impactCode: 'OAO', impactName: 'Other Atlantic Ocean',
    isoCodes: 'BMU BVT CPV FLK FRO SGS SHN SJM SPM STP'.split(' ') },
  { impactCode: 'OBN', impactName: 'Other Balkans',
    isoCodes: ['BIH', 'MKD', 'MNE', 'SRB'] },
  { impactCode: 'OIO', impactName: 'Other Indian Ocean',
    isoCodes: 'ATF CCK COM CXR HMD IOT MDV MUS MYT REU SYC'. split(' ') },
  { impactCode: 'OPO', impactName: 'Other Pacific Ocean',
    isoCodes: 'ASM COK FSM GUM KIR MHL MNP NCL NFK NIU NRU PCN PLW PYF TKL TON UMI WLF WSM'.split(' ') },
  { impactCode: 'OSA', impactName: 'Other Southeast Asia',
    isoCodes: ['BRN', 'SGP'] },
  { impactCode: 'RAP', impactName: 'Rest of Arab Peninsula',
    isoCodes: ['ARE', 'BHR', 'KWT', 'OMN', 'QAT'] },
  { impactCode: 'SPP', impactName: 'Spain Plus',
    isoCodes: ['AND', 'ESP', 'GIB'] },
  { impactCode: 'UKP', impactName: 'Great Britain Plus',
    isoCodes: ['GBR', 'GGY', 'IMN'] }
];
// TODO? also use Table C.4 Standard IMPACT regional aggregations (names in note at bottom of table instead of in table)

// the kinds of response to get-geographic-region (first two in
// reply-report-answer-:location, the rest are failures):

function fileKQML(name, format) {
  return { 0: 'file', name: `"${name}"`, format: format };
}

function codeKQML(code, standard) {
  return { 0: 'code', code: code.toUpperCase(), standard: `"${standard}"` };
}

// other useful functions

/* modify the array dst by adding all elements of src to the end */
function nconc(dst, src) {
  for (var i = 0, j = dst.length; i < src.length; i++, j++) {
    dst[j] = src[i];
  }
  return dst;
}

/* If a file named name exists, just call the callback with fileKQML; if not,
 * run the program with the given args in order to make the file first.
 */
function makeOrGetFile(name, format, callback, program, ...args) {
  fs.access(name, fs.constants.F_OK, (err)=>{
    if (err) { // does not exist yet, call program
      console.log('making ' + name);
      console.log([program, ...args].join(' '));
      child_process.execFile(program, args, (error, stdout, stderr) => {
	if (error) {
	  callback(errors.programError(error.message + 'stderr output: ' + stderr));
	} else {
	  fs.access(name, fs.constants.F_OK, (err2)=>{
	    if (err2) {
	      callback(errors.programError(`${program} succeeded, but did not create its output file.\nstderr output: ${stderr}`));
	    } else {
	      callback(fileKQML(name, format));
	    }
	  });
	}
      });
    } else { // exists already, just call callback
      callback(fileKQML(name, format));
    }
  });
}

/* Are GeoJSON linear ring coordinate lists a and b equivalent? */
/* unused
function ringsEqual(a, b) {
  if (a.length != b.length) { return false; }
  // decrement length because GeoJSON linear rings repeat the first point as
  // the last point, and we need to ignore that when rotating
  var len = a.length - 1;
  // try to find the rotation of b that makes it the same as a elementwise
  for (var r = 0; r < len; r++) { // rotation of b relative to a
    var found = true;
    for (var i = 0; i < len; i++) { // a index
      var ae = a[i];
      var be = b[(i + r) % len];
      if (!(ae[0] == be[0] && ae[1] == be[1])) {
	found = false;
	break; // next rotation
      }
    }
    if (found) {
      return true;
    }
  }
  return false;
}*/

function Spaceman(argv, oninit) {
  CWCModule.call(this, argv);
  this.name = 'Spaceman';
  this.init(() => {
    this.readImpactMetadata();
    this.readIso3166();
    this.initFormats();
    oninit.call(this);
  });
}
util.inherits(Spaceman, CWCModule);

[ // begin Spaceman methods

  function addHandlers() {
    CWCModule.prototype.addHandlers.call(this);
    this.addHandler(KQML.parse('(request &key :content (get-geographic-region . *))'),
    		    this.handleGet);
  },

  function declareCapabilities() {
    this.sendMsg({ 0: 'tell', content: { 0: 'define-service',
      name: 'get-geographic-region',
      component: this.name,
      input: [
        { 0: 'input',
	  name: 'description',
	  gloss: '"description of geographic region"',
	  idCode: 'GEO_DESCRIPTION',
	  format: ['or', 'ont::string', 'ont::list'],
	  requirements: ':required'
	},
	{ 0: 'input',
	  name: 'format',
	  gloss: '"geo format (graphics file or code)"',
	  idCode: 'GEO_FORMAT',
	  format: 'ont::list',
	  requirements: ':required'
	}
      ],
      output: [
        { 0: 'output',
	  name: 'location',
	  gloss: '"file containing a geographic region image, or a code for the region"',
	  idCode: 'LOCATION',
	  format: ['value-of', 'format']
	}
      ]
    }});
  },

  /* Convert (code :code foo :standard "bar") to just foo, wherever it appears
   * in the final result.
   */
  function simplifyCodes(result) {
    if (((Array.isArray(result) && result.length >= 1) || // ugh, JS.
         ('object' == typeof(result) && (0 in result))) &&
	typeof(result[0]) == 'string') {
      if (result[0] == 'list') {
	return result.map(x=>this.simplifyCodes(x));
      } else if (result[0] == 'code') {
	return result.code;
      }
    }
    return result;
  },

  function handleGet(msg) {
    var callback = (result) => {
      if (result[0] == 'failure') {
	this.replyToMsg(msg, 
	    { 0: 'reply', content: { 0: 'report', content: result } });
      } else {
	this.replyToMsg(msg,
	    { 0: 'reply', content: { 0: 'report', content: { 0: 'answer', location: this.simplifyCodes(result) } } });
      }
    };
    try {
      var content = KQML.keywordify(msg.content);
      if (!('format' in content)) {
	throw errors.missingArgument('get-geographic-region', ':format');
      }
      var format = content.format;
      if (!('description' in content)) {
	throw errors.missingArgument('get-geographic-region', ':description');
      }
      var description = content.description;
      this.evaluateDescription(format, description, callback);
    } catch (err) {
      callback(errors.nestedError('while handling get-geographic-region request: ', err));
    }
  },

  /* Call callback with a structure containing the filename of the described
   * region in the given format (file :name "" :format (...)), or an error
   * structure (error :comment "...").
   */
  function evaluateDescription(format, description, callback) {
    try {
      var formatStyle = format[0].toLowerCase();
      var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
      if ('string' == typeof(description) &&
	  description.toLowerCase() == 'wd') {
	this.evaluateWorld(format, formatStyle, formatName, callback);
      } else if (KQML.isKQMLString(description)) {
	var searchStr = KQML.kqmlStringAsJS(description).toLowerCase();
	// NOTE: Errors thrown from evaluateImpact and evaluateIso indicate the
	// searchStr wasn't found, while errors given to the callback indicate
	// some other kind of error, which we mostly don't want to recover from
	// by trying a different method. So even though some errors are async,
	// try/catch still kind of works here.
	try {
	  this.evaluateImpact(format, formatStyle, formatName, undefined, searchStr, callback);
	  // TODO? wrap callback so that if impact fails because format is unsupported (e.g. SVG), we try ISO/OSM if it's a region (country) and not a basin or FPU
	} catch (impactError) {
	  try {
	    this.evaluateIso(format, formatStyle, formatName, undefined, searchStr, callback);
	  } catch (isoError) {
	    if (formatStyle == 'code') { // OSM doesn't output codes
	      callback(errors.nestedError('', isoError));
	    } else {
	      this.evaluateOsm(format, formatStyle, formatName, undefined, searchStr, undefined, callback);
	    }
	  }
	}
      } else if (typeof(description[0]) == 'string') {
	var verb = description[0].toLowerCase();
	if (verb == 'impact' || verb == 'fpu' || verb == 'basin') {
	  if (description.length != 2) {
	    throw errors.invalidArgumentCount(description, 1);
	  }
	  if (!KQML.isKQMLString(description[1])) {
	    throw errors.invalidArgument(description, 1, "string");
	  }
	  var searchStr = KQML.kqmlStringAsJS(description[1]).toLowerCase();
	  this.evaluateImpact(format, formatStyle, formatName, verb, searchStr, callback);
	} else if (verb == 'iso' || verb == 'country') {
	  if (description.length != 2) {
            throw errors.invalidArgumentCount(description, 1);
	  }
	  if (!KQML.isKQMLString(description[1])) {
	    throw errors.invalidArgument(description, 1, "string");
	  }
	  var searchStr = KQML.kqmlStringAsJS(description[1]).toLowerCase();
	  this.evaluateIso(format, formatStyle, formatName, verb, searchStr, callback);
	} else if (verb == 'subcontinent' || verb == 'continent') {
	  if (description.length != 2) {
            throw errors.invalidArgumentCount(description, 1);
	  }
	  if (!KQML.isKQMLString(description[1])) {
	    throw errors.invalidArgument(description, 1, "string");
	  }
	  var searchStr = KQML.kqmlStringAsJS(description[1]).toLowerCase();
	  this.evaluateContinent(format, verb, searchStr, callback);
 	} else if (verb == 'neighbors') {
 	  if (description.length != 2) {
 	    throw errors.invalidArgumentCount(description, 1);
 	  }
 	  this.evaluateDescription(['code','iso'], description[1], (center) => {
 	    try {
 	      if (center[0] == 'code') { // success
 		// make a description for each neighbor from its 2-letter ISO
 		// code
 		var centerCode = KQML.kqmlStringAsJS(center.code).toLowerCase();
 		var neighborDescs =
 		  this.isoCodeToCountry[centerCode].neighbors.
 		  map(n => ['iso', `"${n.twoLetter}"`]);
 		// evaluate them like they were a list of arguments, now using
 		// the originally requested format
 		this.evaluateArguments(format, verb, neighborDescs,
 		  (neighbors) => {
		    if (formatStyle != 'code') {
		      neighbors = neighbors.map(n => fileKQML(n, format));
		    }
 		    // on success, wrap results in list, depending on the
 		    // number
 		    if (neighbors.length == 0) {
 		      // we found the center country, but it has no neighbors
 		      callback(errors.unknownObject(description));
 		    } else if (neighbors.length == 1) {
 		      callback(neighbors[0]);
 		    } else {
 		      callback(['list', ...neighbors]);
 		    }
 		  },
 		  callback // on failure, just do the main callback
 		);
	      // TODO? handle lists of codes
 	      } else if (center[0] == 'failure') {
 		callback(center);
 	      } else {
 		callback(errors.programError("expected a code or a failure from evaluating neighbors' argument with :format (code iso), but got a " + center[0]));
 	      }
 	    } catch (err) {
 	      callback(errors.nestedError("while processing neighbors results: ", err));
 	    }
 	  });
	} else if (verb == 'intersection') {
	  if (formatStyle == 'raster') {
	    this.composite(format, 'intersection', 'darken', description.slice(1),
			   [], callback);
	  } else if (formatStyle == 'vector') {
	    this.vectorSetOp(format, verb, description.slice(1), callback);
	  } else { // code
	    this.codeListSetOp(format, verb, description.slice(1), callback);
	  }
	} else if (verb == 'union') {
	  if (formatStyle == 'raster') {
	    this.composite(format, 'union', 'lighten', description.slice(1),
			   [], callback);
	  } else if (formatStyle == 'vector') {
	    this.vectorSetOp(format, verb, description.slice(1), callback);
	  } else { // code
	    this.codeListSetOp(format, verb, description.slice(1), callback);
	  }
	} else if (verb == 'complement') { // complement of union
	  if (formatStyle == 'raster') {
	    this.composite(format, 'complement', 'darken', description.slice(1),
			   ['-negate'], callback);
	  } else if (formatStyle == 'vector') {
	    this.vectorSetOp(format, verb, description.slice(1), callback);
	  } else { // code
	    this.codeListSetOp(format, verb, description.slice(1), callback);
	  }
	} else if (verb == 'difference') {
	  this.evaluateDescription(format, ['intersection', description[1], ['complement'].concat(description.slice(2))], callback);
	} else if (formatStyle == 'code' &&
	           'osm state county box zone lune'.split(/ /).includes(verb)) {
	  throw errors.invalidArgumentCombo("shape atoms and OSM-based lookup atoms may not be used as descriptions with code output format");
	} else if (verb == 'osm' || verb == 'state' || verb == 'county') {
	  if (description.length < 2 || description.length > 3) {
	    throw errors.invalidArgumentCount(description, '1 or 2');
	  }
	  if (!KQML.isKQMLString(description[1])) {
	    throw errors.invalidArgument(description, 1, "string");
	  }
	  var searchStr = KQML.kqmlStringAsJS(description[1]).toLowerCase();
	  var countryCode = undefined;
	  if (description.length >= 3) {
	    if (!KQML.isKQMLString(description[2])) {
	      throw errors.invalidArgument(description, 2, "string");
	    }
	    countryCode = KQML.kqmlStringAsJS(description[2]).toLowerCase();
	    // TODO more general country lookup?
	    if (!(countryCode in this.isoCodeToCountry)) {
	      throw errors.unknownObject(['country', description[2]]);
	    }
	    // standardize on 2-letter code
	    countryCode = this.isoCodeToCountry[countryCode].twoLetter;
	  }
	  this.evaluateOsm(format, formatStyle, formatName, verb, searchStr, countryCode, callback);
	} else if (verb == 'box') {
	  if (description.length != 5) {
	    throw errors.invalidArgumentCount(description, 4);
	  }
	  var args = description.slice(1);
	  // invalidArgument for non-numeric coords
	  var nonNumIndex = args.findIndex(n => (typeof(n) != 'number'));
	  if (nonNumIndex != -1) {
	    throw errors.invalidArgument(description, nonNumIndex + 1, 'number');
	  }
	  // invalidArgument for coords out of range
	  if (args[0] < -180 || args[0] > 180) {
	    throw errors.invalidArgument(description, 1, 'number in [-180,180]');
	  }
	  if (args[1] < -90 || args[1] > 90) {
	    throw errors.invalidArgument(description, 2, 'number in [-90,90]');
	  }
	  if (args[2] < -180 || args[2] > 180) {
	    throw errors.invalidArgument(description, 3, 'number in [-180,180]');
	  }
	  if (args[3] < -90 || args[3] > 90) {
	    throw errors.invalidArgument(description, 4, 'number in [-90,90]');
	  }
	  // invalidArgumentCombo for min > max coords
	  if (args[0] > args[2] || args[1] > args[3]) {
	    throw errors.invalidArgumentCombo('min > max');
	  }
	  var outputBase = `${cacheDirParent}computed/[box--${args.join('--')}]`;
	  // write GeoJSON-format output
	  var outputFileGJ = `${outputBase}.GeoJSON`;
	  fs.writeFileSync(outputFileGJ, JSON.stringify({
	    type: "Polygon",
	    coordinates: [[
	      // CCW around the box starting and ending at SW corner
	      [args[0], args[1]],
	      [args[2], args[1]],
	      [args[2], args[3]],
	      [args[0], args[3]],
	      [args[0], args[1]]
	    ]]
	  })); // TODO de-Sync-ify?
	  if (formatStyle == 'raster') {
	    this.rasterize(format, outputFileGJ, outputBase, [], callback);
	  } else if (formatName != 'geojson') {
	    this.convertVectorFormats(format, outputFileGJ, outputBase, [], callback);
	  } else { // no conversion necessary
	    callback(fileKQML(outputFileGJ, format));
	  }
	} else if (verb == 'zone') {
	  if (description.length != 3) {
	    throw errors.invalidArgumentCount(description, 2);
	  }
	  this.evaluateDescription(format, ['box', -180, description[1], 180, description[2]], callback);
	} else if (verb == 'lune') {
	  if (description.length != 3) {
	    throw errors.invalidArgumentCount(description, 2);
	  }
	  this.evaluateDescription(format, ['box', description[1], -90, description[2], 90], callback);
	} else {
	  throw errors.unknownAction(verb);
	}
      } else {
	throw errors.unknownAction(description[0]);
      }
    } catch (err) {
      callback(errors.nestedError('', err));
    }
  },

  function isValidIsoCodeFormatName(formatName) {
    return /^iso(?:[ -]?3166(?:-1)?)?(| alpha-[23]| numeric)$/.test(formatName);
  },

  // assumes formatName is valid
  function countryToCodeKQML(country, formatName) {
    if (formatName == 'impact') {
      // check that this code represents *only* this country
      if (country.threeLetter != country.impactCode) {
	throw errors.invalidArgumentCombo("no IMPACT code correctly represents this country alone");
      }
      return codeKQML(country.impactCode, 'IMPACT');
    } else if (/ numeric$/.test(formatName)) {
      return codeKQML(country.threeDigit, 'ISO 3166-1 numeric');
    } else if (/ alpha-3$/.test(formatName)) {
      return codeKQML(country.threeLetter, 'ISO 3166-1 alpha-3');
    } else { // alpha-2 or unspecified
      return codeKQML(country.twoLetter, 'ISO 3166-1 alpha-2');
    }
  },

  function evaluateImpact(format, formatStyle, formatName, verb, searchStr, callback) {
    var table = (verb == 'basin' ? this.basinNames : this.impactNames);
    if (!(searchStr in table)) {
      throw errors.unknownObject([verb || 'impact', `"${KQML.escapeForQuotes(searchStr)}"`]);
    }
    var metadata = table[searchStr];
    if (verb == 'fpu' && metadata.type != 'FPU') {
      throw errors.unknownObject(['fpu', `"${KQML.escapeForQuotes(searchStr)}"`]);
    }
    if (formatStyle == 'code') {
      if (formatName == 'impact') {
	callback(codeKQML(metadata.code, 'IMPACT'));
      } else if (this.isValidIsoCodeFormatName(formatName)) {
	var countries = this.impactCodeToCountries[metadata.code.toLowerCase()];
	if (!countries) {
	  throw errors.invalidArgumentCombo("IMPACT code does not represent a country or set of countries: " + metadata.code);
	}
	var codes = countries.map((country) =>
			this.countryToCodeKQML(country, formatName));
	if (codes.length == 1) {
	  callback(codes[0]);
	} else {
	  callback(['list', ...codes]);
	}
      } else {
	throw errors.invalidArgument(format, 1, "one of 'IMPACT', 'ISO 3166-1 alpha-2', 'ISO 3166-1 alpha-3', 'ISO 3166-1 numeric'");
      }
    } else {
      var inputFile = `${installDir}/fpu/map.shp`;
      var outputBase =
	`${cacheDirParent}impact/${metadata.type}-${metadata.code}`;
      var extraArgs = 
	['-where', `New_${metadata.type}='${metadata.code}'`];
      if (formatStyle == 'raster') {
	this.rasterize(format, inputFile, outputBase, extraArgs, callback);
      } else if (formatStyle == 'vector') {
	this.convertVectorFormats(format, inputFile, outputBase, extraArgs, callback);
	// TODO? use cty instead of fpu if it's a region; if it's a basin still need to merge somehow... maybe ogr2ogr will do it for us?
      } else {
	throw errors.unknownAction(formatStyle);
      }
    }
  },

  function evaluateWorld(format, formatStyle, formatName, callback) {
    if (formatStyle == 'code') {
      if (formatName == 'impact') {
	var codes = Object.keys(this.regions).sort();
	callback(['list', ...codes.map(code => codeKQML(code, 'IMPACT'))]);
      } else if (this.isValidIsoCodeFormatName(formatName)) {
	var answer = ['list'];
	for (var code in this.isoCodeToCountry) {
	  if (/^\d{3}$/.test(code)) { // use only 3-digit codes so we don't dupe
	    answer.push(
	      this.countryToCodeKQML(this.isoCodeToCountry[code], formatName));
	  }
	}
	callback(answer);
      } else {
	throw errors.invalidArgument(format, 1, "one of 'IMPACT', 'ISO 3166-1 alpha-2', 'ISO 3166-1 alpha-3', 'ISO 3166-1 numeric'");
      }
    } else { // raster or vector
      var inputFile = `${installDir}/fpu/map.shp`;
      var outputBase = `${cacheDirParent}WD`;
      var extraArgs = [];
      if (formatStyle == 'raster') {
	this.rasterize(format, inputFile, outputBase, extraArgs, callback);
      } else if (formatStyle == 'vector') {
	this.convertVectorFormats(format, inputFile, outputBase, extraArgs, callback);
      } else {
	throw errors.unknownAction(formatStyle);
      }
    }
  },

  function evaluateIso(format, formatStyle, formatName, verb, searchStr, callback) {
    // find a single ISO country structure using searchStr
    var country = undefined;
    if (searchStr in this.isoCodeToCountry) {
      country = this.isoCodeToCountry[searchStr];
    } else if (searchStr in this.nameToCountries) {
      if (this.nameToCountries[searchStr].length == 1) {
	country = this.nameToCountries[searchStr][0];
      } else {
	throw errors.ambiguous([verb || 'iso', `"${KQML.escapeForQuotes(searchStr)}"`],
	                this.nameToCountries[searchStr].map(
			  (country) =>
			    ['iso', `"${country.twoLetter.toUpperCase()}"`]));
      }
    } else {
      if (verb != 'country') {
	// fall back to continent, then subcontinent
	if (searchStr in this.continentToCountries) {
	  this.evaluateContinent(format, 'continent', searchStr, callback);
	  return;
	} else if (searchStr in this.subcontinentToCountries) {
	  this.evaluateContinent(format, 'subcontinent', searchStr, callback);
	  return;
	}
      }
      throw errors.unknownObject([verb || 'iso', `"${KQML.escapeForQuotes(searchStr)}"`]);
    }
    // now country is set
    if (formatStyle == 'code') {
      if (!this.isValidIsoCodeFormatName(formatName)) {
	throw errors.invalidArgument(format, 1, "one of 'ISO 3166-1 alpha-2', 'ISO 3166-1 alpha-3', 'ISO 3166-1 numeric'");
      }
      callback(this.countryToCodeKQML(country, formatName));
    } else {
      if (country.threeLetter != country.impactCode) {
	// impact doesn't have this specific country, only a merged "region", so look up the actual country in OSM
	this.evaluateOsm(format, formatStyle, formatName, 'country', country.names[0], country.twoLetter, callback);
      } else { // impact does have this country (in theory)
	this.evaluateImpact(format, formatStyle, formatName, undefined, country.impactCode, callback);
      }
    }
  },

  // continent or subcontinent from ISO
  function evaluateContinent(format, verb, searchStr, callback) {
    var countries = this[verb + 'ToCountries'][searchStr.toLowerCase()];
    if (!countries) {
      throw errors.unknownObject([verb, `"${KQML.escapeForQuotes(searchStr)}"`]);
    }
    var newDesc = ['union', ...countries.map(c => ['iso', `"${c.twoLetter}"`])];
    this.evaluateDescription(format, newDesc, callback);
  },

  function evaluateOsm(format, formatStyle, formatName, verb, searchStr, countryCode, callback) {
    var osmFormat = 'geojson';
    var convert = true;
    if (formatStyle == 'vector') {
      convert = false;
      if (formatName == 'geojson') { osmFormat = 'geojson';
      } else if (formatName == 'kml') { osmFormat = 'kml';
      } else if (formatName == 'svg') { osmFormat = 'svg';
      } else if (formatName == 'wkt') { osmFormat = 'text';
      } else { convert = true; }
    }
    var placeTypes = undefined;
    if (verb == 'country') {
      placeTypes = ['country'];
    } else if (verb == 'state') {
      placeTypes = ['state', 'province'];
    } else if (verb == 'county') {
      placeTypes = ['county', 'district'];
    }
    if (convert) {
      this.osm(osmFormat, placeTypes, searchStr, countryCode, result => {
	if (result[0] == 'file') { // success
	  var filename = KQML.kqmlStringAsJS(result.name);
	  var base = filename.replace(/\.[^\.]+$/, '');
	  // convert
	  try {
	    if (formatStyle == 'raster') {
	      this.rasterize(format, filename, base, [], callback);
	    } else if (formatStyle == 'vector') {
	      this.convertVectorFormats(format, filename, base, [], callback);
	    } else {
	      throw errors.unknownAction(formatStyle);
	    }
	  } catch (err) {
	    callback(errors.nestedError('during format conversion: ', err));
	  }
	} else {
	  callback(result);
	}
      });
    } else {
      this.osm(osmFormat, placeTypes, searchStr, countryCode, result => {
	result.format = format;
	callback(result)
      });
    }
  },

  function rasterize(format, inputFile, outputBase, extraGdalArgs, callback) {
    var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
    if ((formatName in this.formats) && this.formats[formatName].magickWrite &&
        !this.formats[formatName].gdalWrite) {
      // GDAL can't write this format, but ImageMagick can, so use GDAL to
      // write in GTiff format, and then use ImageMagick to convert
      this.rasterize(
        ['raster', '"GTiff"', format[2], format[3]],
	inputFile, outputBase, extraGdalArgs,
	(file) => {
	  if (file[0] == 'failure') {
	    callback(file);
	  } else {
	    this.convertRasterFormats(format, KQML.kqmlStringAsJS(file.name), outputBase, [], callback);
	  }
	}
      );
      return;
    }
    var width = format[2];
    var height = format[3];
    var outputFile = `${outputBase}-${width}x${height}.${formatName}`;
    makeOrGetFile(outputFile, format, callback,
      'gdal_rasterize',
      '-burn', '1',
      ...extraGdalArgs,
      '-of', formatName,
      '-te', '-180', '-90', '180', '90', // real lon/lat extents
      '-ts', width, height, // size in pixels
      // tried to do this instead of -depth 8 in ImageMagick, but this also
      // results in a blank image :(
      //'-ot', 'Byte', // sample type
      inputFile,
      outputFile
    );
  },

  /* Evaluate each of argDescs, and either call success with a list of
   * filenames (not fileKQMLs) or codeKQMLs (not raw codes), depending on
   * format, or call failure with a failure structure.
   */
  function evaluateArguments(format, operator, argDescs, success, failure) {
    var responses = [];
    // to be called when we have responses for all args
    function done() {
      if (responses.every(r=>(r[0]!='failure'))) { // no failures
	if (format[0].toLowerCase() == 'code') {
	  success(responses);
	} else { // raster or vector files
	  success(responses.map(r=>KQML.kqmlStringAsJS(r.name)));
	}
      } else { // some failures
	var errors =
	  responses.
	  filter(r=>(r[0]=='failure')); /*.
	  map(r=>r.comment).
	  join('; ');
	failure(errors.programError(`while evaluating arguments of ${operator}: ${errors}`));*/
	if (errors.length == 1) {
	  failure(errors[0]);
	} else {
	  failure({ 0: 'failure', type: 'cannot-perform', reason: { 0: 'multiple', failures: errors } });
	}
      }
    }
    if (argDescs.length == 0) { // nothing to do
      done();
    } else {
      argDescs.forEach(arg => {
	this.evaluateDescription(format, arg, response => {
	  responses.push(response);
	  if (responses.length == argDescs.length) {
	    done();
	  }
	});
      });
    }
  },

  // TEST:
  // (request :content (get-geographic-region :description (intersection "arkansas" "texas") :format (raster "GTiff" 720 360)))
  // should intersect arkansas impact basin with the state of texas from osm
  // should be nonempty intersection
  function composite(format, kqmlOperator, magickOperator, argDescs, extraMagickArgs, callback) {
    var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
    var width = format[2];
    var height = format[3];
    this.evaluateArguments(format, kqmlOperator, argDescs,
      inputFiles => {
	// sort inputFiles so that we always generate the same outputFile name
	// regardless of the order of the arguments, so that caching works
	// better
	inputFiles.sort();
	// construct output file name from operator, input file names and format
	var inputNames = inputFiles.map(f=>
	  f.
	  slice(cacheDirParent.length).
	  replace(/^computed\//, '').
	  replace(/-\d+x\d+\.\w+$/, '').
	  replace(/\//, '-')
	).join('--');
	var outputFile = `${cacheDirParent}computed/[${kqmlOperator}--${inputNames}]-${width}x${height}.${formatName}`;
	// must put -composite after every input file except the first, forming
	// a chain of two-argument composite operations (could also make a
	// balanced binary tree, but that's more complicated)
	var inputArgs = [inputFiles[0]];
	for (var i = 1; i < inputFiles.length; i++) {
	  inputArgs.push(inputFiles[i], '-composite');
	}
	makeOrGetFile(outputFile, format, callback,
	  'convert',
	  '-compose', magickOperator,
	  // GTiff from gdal_rasterize is 64-bit greyscale, and composite
	  // doesn't like that for some reason (yields a blank image), so
	  // convert to 8-bit here
	  '-depth', '8',
	  // in case we're composing images in a format that doesn't have
	  // dimension information, like GRAY
	  '-size', width + 'x' + height,
	  ...extraMagickArgs,
	  ...inputArgs,
	  outputFile
	);
      },
      callback
    );
  },

  /* Convert any GeoJSON object to a MultiPolygon containing all the same
   * polygons.
   */
  function convertToMultiPolygon(gj) {
    if (gj.type == 'MultiPolygon') {
      return gj;
    } else if (gj.type == 'Polygon') {
      gj.type = 'MultiPolygon';
      gj.coordinates = [gj.coordinates];
      return gj;
    } else if (gj.type == 'Feature') {
      return convertToMultiPolygon(gj.geometry);
    } else if (gj.type == 'GeometryCollection') {
      var coordinates = [];
      gj.geometries.forEach(g => {
	nconc(coordinates, convertToMultiPolygon(g).coordinates);
      });
      return { type: 'MultiPolygon', coordinates: coordinates };
    } else if (gj.type == 'FeatureCollection') {
      var coordinates = [];
      gj.features.forEach(f => {
	nconc(coordinates, convertToMultiPolygon(f).coordinates);
      });
      return { type: 'MultiPolygon', coordinates: coordinates };
    } else {
      console.log('warning: ignoring GeoJSON object of type ' + gj.type);
      return { type: 'MultiPolygon', coordinates: [] };
    }
  },

  /* Read a GeoJSON file and return all the polygons it contains in a single
   * MultiPolygon structure (whether or not there is more than one polygon, or
   * more than one feature, or other geometries besides polygons).
   */
  function readGeoJsonMultiPolygon(filename) {
    var gj = JSON.parse(fs.readFileSync(filename, 'utf8')); // TODO de-Sync-ify?
    return this.convertToMultiPolygon(gj);
  },

  function vectorSetOp(format, operator, argDescs, callback) {
    var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
    // get arguments as GeoJSON
    this.evaluateArguments(
      ['vector', '"GeoJSON"'], operator, argDescs,
      inputFiles => {
	// sort inputFiles so that we always generate the same outputFile name
	// regardless of the order of the arguments, so that caching works
	// better
	inputFiles.sort();
	// construct output file name from operator, input file names and format
	var inputNames = inputFiles.map(f=>
	  f.
	  slice(cacheDirParent.length).
	  replace(/^computed\//, '').
	  replace(/\.GeoJSON$/i, '').
	  replace(/\//, '-')
	).join('--');
	var outputBase = `${cacheDirParent}computed/[${operator}--${inputNames}]`;
	var outputFile = `${outputBase}.${formatName}`;
	var outputFileGJ = `${outputBase}.GeoJSON`;
	fs.access(outputFileGJ, fs.constants.F_OK, (err)=>{
	  if (err) { // outputFile does not exist yet, make it
	    // read GeoJSONs of arguments and convert each to a MultiPolygon
	    var inputMPs = inputFiles.map(f => this.readGeoJsonMultiPolygon(f));
	    var outputGeom = SetOps[operator](inputMPs);
	    // write mp to a file
	    fs.writeFileSync(outputFileGJ, JSON.stringify(outputGeom)); // TODO de-Sync-ify?
	  }
	  // convert to format if not (vector "GeoJSON")
	  if (formatName != 'geojson') {
	    this.convertVectorFormats(format, outputFileGJ, outputBase, [], callback);
	  } else {
	    callback(fileKQML(outputFileGJ, format));
	  }
	});
      },
      callback
    );
  },

  function codeListSetOp(format, operator, argDescs, callback) {
    this.evaluateArguments(format, operator, argDescs,
      results => {
	// get a simple list of lists of code strings from results, as well as
	// the code standard (which should be the same for all codes)
	var standard;
	var codeLists = [];
	results.forEach(result => {
	  var codeList;
	  if (result[0] == 'code') {
	    codeList = [result.code];
	    if (!standard) {
	      standard = KQML.kqmlStringAsJS(result.standard);
	    }
	  } else { // list
	    codeList = result.slice(1).map(codeKQML => codeKQML.code);
	    if (result.length > 1 && !standard) {
	      standard = KQML.kqmlStringAsJS(result[1].standard);
	    }
	  }
	  codeLists.push(codeList);
	});
	var resultCodeList;
	switch(operator) {
	  case 'intersection':
	    var first = codeLists[0];
	    var rest = codeLists.slice(1);
	    // get the codes from the first list that every other list includes
	    resultCodeList =
	      first.filter(code =>
	        rest.every(codeList => codeList.includes(code)));
	    break;
	  case 'union':
	    // put all codes into the keys of an Object to deduplicate them
	    var codeMap = {};
	    codeLists.forEach(codeList => {
	      codeList.forEach(code => {
		codeMap[code] = true;
	      });
	    });
	    resultCodeList = Object.keys(codeMap);
	    break;
	  case 'complement':
	    // put all codes from the standard into the keys of an Object
	    var codeMap = {};
	    if (standard == 'IMPACT') {
	      for (var impactRegionCode in this.regions) {
		codeMap[impactRegionCode.toUpperCase()] = true;
	      }
	    } else { // ISO of some flavor
	      for (var code in this.isoCodeToCountry) {
		// use only 3-digit codes so we don't dupe
		if (/^\d{3}$/.test(code)) {
		  var theCodeKQML =
		    this.countryToCodeKQML(this.isoCodeToCountry[code],
					   standard);
		  codeMap[theCodeKQML.code] = true;
		}
	      }
	    }
	    // delete the ones that are in the codeLists
	    codeLists.forEach(codeList => {
	      codeList.forEach(code => {
		delete codeMap[code];
	      });
	    });
	    resultCodeList = Object.keys(codeMap);
	    break;
	  default:
	    callback(unknownAction(operator));
	    return;
	}
	var resultKQMLList =
	  resultCodeList.sort().map(code => codeKQML(code, standard));
	if (resultKQMLList.length == 0) {
	  callback(errors.unknownObject([operator, ...argDescs]));
	} else if (resultKQMLList.length == 1) {
	  callback(resultKQMLList[0]);
	} else {
	  callback(['list', ...resultKQMLList]);
	}
      },
      callback
    );
  },

  function convertRasterFormats(format, inputFile, outputBase, extraMagickArgs, callback) {
    var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
    var width = format[2];
    var height = format[3];
    var outputFile = `${outputBase}-${width}x${height}.${formatName}`;
    makeOrGetFile(outputFile, format, callback,
      'convert',
      // GTiff from gdal_rasterize is 64-bit greyscale, and convert
      // doesn't like that for some reason (yields a blank image), so
      // convert to 8-bit here
      '-depth', '8',
      ...extraMagickArgs,
      inputFile,
      outputFile
    );
  },

  function convertVectorFormats(format, inputFile, outputBase, extraOgrArgs, callback) {
    var formatName = KQML.kqmlStringAsJS(format[1]).toLowerCase();
    var outputFile = `${outputBase}.${formatName}`;
    makeOrGetFile(outputFile, format, callback,
      'ogr2ogr',
      ...extraOgrArgs,
      '-f', formatName,
      outputFile, inputFile
    );
  },

  /* Call OSM or get cached response. Similar interface to evaluateDescription,
   * except format must be one of 'kml', 'svg', 'text' (for WKT), or 'geojson'.
   */
  function osm(format, placeTypes, searchStr, countryCode, callback) {
    searchStr = searchStr.replace(/[^\w\d,\.-]/g, ' ');
    var basename = searchStr.replace(/\s/g, '_');
    var verb = 'osm';
    if (placeTypes) {
      verb = placeTypes[0]; // HACK: this just happens to be so
      basename += '--' + verb;
    }
    if (countryCode) {
      countryCode = countryCode.toLowerCase();
      basename += '--' + countryCode;
    }
    var filename = `${cacheDirParent}osm/${basename}.${format}`
    if (fs.existsSync(filename)) { // TODO de-Sync-ify
      callback(fileKQML(filename, format));
    } else {
      console.log('making ' + filename);
      var query = {
	q: searchStr,
	format: 'json',
      };
      query[`polygon_${format}`] = 1;
      if (countryCode) {
	query.countrycodes = countryCode;
      }
      if (placeTypes) {
	query.extratags = 1;
      }
      var host = 'nominatim.openstreetmap.org';
      var path = '/search?' + querystring.stringify(query);
      console.log(`https://${host}/${path}`);
      var req = https.request({
	host: host,
	path: path,
	headers: {
	  'User-Agent': 'TRIPS Spaceman (wbeaumont@ihmc.us)'
	}
      }, res => {
	try {
	  if (res.statusCode == 200) {
	    var content = '';
	    res.on('data', d => { content += d });
	    res.on('end', () => {
	      try {
		var json = JSON.parse(content);
		if (placeTypes) {
		  json = json.filter(x =>
		    ('extratags' in x) && placeTypes.includes(x.extratags.place)
		  );
		}
		if (json.length >= 1) {
		  var polygons = json[0][format];
		  if (format == 'geojson') {
		    polygons = JSON.stringify(polygons);
		  } else if (format == 'svg') {
		    // wrap svg path in a full svg xml file, defining viewBox
		    polygons = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-180 -90 360 180"><path d="${polygons}" /></svg>`;
		  }
		  fs.writeFileSync(filename, polygons); // TODO de-Sync-ify
		  callback(fileKQML(filename, format));
		} else {
		  throw errors.unknownObject([verb, `"${KQML.escapeForQuotes(searchStr)}"`]);
		}
	      } catch (err) {
		callback(errors.nestedError('while processing OSM response: ', err));
	      }
	    });
	  } else {
	    req.abort();
	    throw errors.programError('nominatim returned status code ' + res.statusCode + '; headers: ' + JSON.stringify(res.headers));
	  }
	} catch (err) {
	  callback(errors.nestedError('', err));
	}
      });
      req.end();
    }
  },

  function readImpactMetadata() {
    var str =
      child_process.execFileSync(
        'ogrinfo', ['-al', '-geom=NO', `${installDir}/fpu/map.shp`],
	{ encoding: 'utf8' });
    this.fpus = {};
    this.basins = {};
    this.regions = {};
    var New_FPU = undefined;
    var Basin_Name = undefined;
    str.split(/[\r\n]+/).forEach(line => {
      if (/^  New_FPU \(String\) = /.test(line)) {
	New_FPU = line.slice(21);
      } else if (/^  Basin_Name \(String\) = /.test(line)) {
	Basin_Name = line.slice(24);
      } else if (/^  Region_Nam \(String\) = /.test(line)) {
	var Region_Nam = line.slice(24);
	var basinCode = New_FPU.slice(0,3);
	var regionCode = New_FPU.slice(4);
	if (this.basins[basinCode] === undefined) {
	  this.basins[basinCode] =
	    { type: 'Basin', name: Basin_Name, code: basinCode };
	}
	var basin = this.basins[basinCode];
	if (this.regions[regionCode] === undefined) {
	  this.regions[regionCode] =
	    { type: 'Region', name: Region_Nam, code: regionCode };
	}
	var region = this.regions[regionCode];
	this.fpus[New_FPU] =
	  { type: 'FPU', code: New_FPU, basin: basin, region: region };
      }
    });
    this.impactNames = {};
    this.basinNames = {};
    for (var c in this.fpus) {
      this.impactNames[c.toLowerCase()] = this.fpus[c];
    }
    for (var c in this.basins) {
      var name = this.basins[c].name.toLowerCase();
      this.impactNames[c.toLowerCase()] = this.impactNames[name] =
      this.basinNames[c.toLowerCase()] = this.basinNames[name] =
        this.basins[c];
    }
    for (var c in this.regions) {
      var name = this.regions[c].name.toLowerCase();
      this.impactNames[c.toLowerCase()] = this.impactNames[name] =
        this.regions[c];
    }
  },

  function readIso3166() {
    this.isoCodeToCountry = {};
    this.impactCodeToCountries = {};
    this.nameToCountries = {};
    this.continentToCountries = {};
    this.subcontinentToCountries = {};
    var str = fs.readFileSync(installDir + '/countries.json', 'utf-8');
    var countries = JSON.parse(str);
    // add some countries missing from countries.json that we would have gotten
    // from Wikipedia's ISO 3166 table
    countries.push({
      name: {
	common: 'Bonaire, Sint Eustatius and Saba',
	official: 'Bonaire, Sint Eustatius and Saba'
      },
      altSpellings: [],
      cca2: 'BQ',
      cca3: 'BES',
      ccn3: '535',
      region: 'Americas',
      subregion: 'Caribbean',
      borders: []
    });
    countries.push({
      name: {
	common: 'Saint Helena, Ascension and Tristan da Cunha',
	official: 'Saint Helena, Ascension and Tristan da Cunha'
      },
      altSpellings: [],
      cca2: 'SH',
      cca3: 'SHN',
      ccn3: '654',
      // they're kind of in the middle of the south atlantic ocean, but I'm
      // guessing they're closest to the "Southern Africa" region
      region: 'Africa',
      subregion: 'Southern Africa',
      borders: []
    });
    countries.forEach((json) => {
      if (json.region == '') {
	json.region = "Antarctica";
	json.subregion = "Antarctica";
      }
      var country = {
	twoLetter: json.cca2.toLowerCase(),
	threeLetter: json.cca3.toLowerCase(),
	threeDigit: json.ccn3,
	names: [json.name.common, json.name.official, ...json.altSpellings],
	continent: json.region,
	subcontinent: json.subregion,
	neighborCodes: json.borders
      };
      var newNames = [];
      country.names.forEach((name) => {
	// "foo (bar) baz" => "foo baz"
	var m = /^([^\(\)]+?) \([^\)]+\)(.*)$/.exec(name);
	if (m) {
	  newNames.push(m[1] + m[2]);
	}
      });
      var merger = impactMergers.find((x) => x.isoCodes.includes(json.cca3));
      country.impactCode =
        (merger ? merger.impactCode.toLowerCase() : country.threeLetter);
      if (merger) {
	newNames.push(merger.impactName);
      }
      country.names = [...new Set(country.names.concat(newNames))];
      this.isoCodeToCountry[country.twoLetter] = country;
      this.isoCodeToCountry[country.threeLetter] = country;
      this.isoCodeToCountry[country.threeDigit] = country;
      if (!(country.impactCode in this.impactCodeToCountries)) {
	this.impactCodeToCountries[country.impactCode] = [];
      }
      this.impactCodeToCountries[country.impactCode].push(country);
      country.names.forEach((name) => {
	var lcName = name.toLowerCase();
	if (!(lcName in this.nameToCountries)) {
	  this.nameToCountries[lcName] = [];
	}
	this.nameToCountries[lcName].push(country);
      });
      if (country.impactCode != country.threeLetter) {
	country.impactMergedName = country.names.pop();
      }
      var lcContinent = country.continent.toLowerCase();
      if (!(lcContinent in this.continentToCountries)) {
	this.continentToCountries[lcContinent] = [];
      }
      this.continentToCountries[lcContinent].push(country);
      var lcSubcontinent = country.subcontinent.toLowerCase();
      if (!(lcSubcontinent in this.subcontinentToCountries)) {
	this.subcontinentToCountries[lcSubcontinent] = [];
      }
      this.subcontinentToCountries[lcSubcontinent].push(country);
    });
    // convert neighbor codes to neighbor objects
    countries.forEach((json) => {
      var country = this.isoCodeToCountry[json.cca2.toLowerCase()];
      country.neighbors =
        country.neighborCodes.map(
	    (code) => this.isoCodeToCountry[code.toLowerCase()]);
    });
  },

  /* Figure out which formats each tool can read or write. */
  function initFormats() {
    this.formats = {};
    var gdalFormats =
      child_process.execFileSync(
        'gdal_rasterize', ['--formats'],
	{ encoding: 'utf8' }
      ).split(/\n/);
    var ogrFormats =
      child_process.execFileSync(
        'ogr2ogr', ['--formats'],
	{ encoding: 'utf8' }
      ).split(/\n/);
    gdalFormats.concat(ogrFormats).forEach(line => {
      var m = /^\s*([\w\s\.]+?)\s*-(raster)?,?(vector)?-\s*\((rw\+?|ro|w\+?)/.exec(line);
      if (!m) {
	return;
      }
      var name = m[1].toLowerCase();
      if (name in this.formats) { // already did this one
	return;
      }
      this.formats[name] = {
	styles: [],
	gdalRead: /r/.test(m[4]),
	gdalWrite: /w\+/.test(m[4]) // gdal_rasterize only works if the destination format is w+, not just w (ARGH!)
      };
      if (m[2] == 'raster') {
	this.formats[name].styles.push('raster');
      }
      if (m[3] == 'vector') {
	this.formats[name].styles.push('vector');
      }
    });
    var magickFormats =
      // NOTE: using spawnSync in order to ignore convert's inexplicable
      // nonzero exit status
      child_process.spawnSync(
        'convert', ['-list', 'format'],
	{ encoding: 'utf8' }
      ).stdout.
      split(/\n/).
      filter(line => /\s[r-][w-][+-]\s/.test(line)).
      filter(line => !/:\/\/\)/.test(line)). // no URLs please
      filter(line => !/\bVideo\b/.test(line)). // no video formats please
      map(line => {
	var mode = /\s([r-])([w-])[+-]\s/.exec(line);
	return {
	  name: /^\s*(\w+)/.exec(line)[1].toLowerCase(),
	  read: (mode[1] == 'r'),
	  write: (mode[2] == 'w')
	};
      });
    magickFormats.forEach(f => {
      if ((f.name in this.formats) &&
	  !this.formats[f.name].styles.includes('raster')) {
	console.warn(`WARNING: dropping ImageMagick-supported raster format ${f.name} because it is also an OGR-supported vector format`);
      } else if (f.read || f.write) { // must be readable and/or writable or it's useless
	if (!(f.name in this.formats)) {
	  this.formats[f.name] = { styles: ['raster'] };
	}
	if (f.read) {
	  this.formats[f.name].magickRead = true;
	}
	if (f.write) {
	  this.formats[f.name].magickWrite = true;
	}
      }
    });
    // GTiff is similar enough to regular tiff that ImageMagick *can* read it,
    // although it complains about it
    if (('gtiff' in this.formats) && ('tiff' in this.formats) &&
        this.formats.tiff.magickRead) {
      this.formats.gtiff.magickRead;
    }
    if (this.debuggingEnabled) {
      Object.keys(this.formats).sort().forEach(k => {
	this.debug(`${k} => ${JSON.stringify(this.formats[k])}`);
      });
    }
  }

].map(fn=>{ Spaceman.prototype[fn.name] = fn; });

module.exports = Spaceman;

if (require.main === module) {
  new Spaceman(process.argv, function() { this.run() });
}
