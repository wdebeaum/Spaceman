'use strict';

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto'); // for MD5 hash for comparing graphics
const errors = require('util/cwc/errors.js');
const KQML = require('KQML/kqml.js');
const Spaceman = require('Spaceman.js');

const cacheDirParent = process.env.TRIPS_BASE + '/etc/Spaceman/cache/';

// disable sending messages, to avoid cluttering stdout
Spaceman.prototype.sendMsg = function() {}

describe('evaluateDescription', function() {
  // shorthand code formats
  var codeI = ['code', '"IMPACT"'];
  var codeA2 = ['code', 'ISO 3166-1 alpha-2'];
  var codeA3 = ['code', 'ISO 3166-1 alpha-3'];
  var codeN3 = ['code', 'ISO 3166-1 numeric'];
  // graphics format that allows no variation (raw grayscale)
  var gray = ['raster', '"gray"', 720, 360];

  var sm;
  before(function(done) {
    sm = new Spaceman(['-connect', 'no'], done);
  });

  // assert that evaluateDescription gives the expectedResult (after
  // simplifyCodes) when given format and description, and call done as
  // appropriate
  function assertResult(done, format, description, expectedResult) {
    sm.evaluateDescription(format, description, (actualResult) => {
      try {
	if (actualResult[0] != 'failure') {
	  actualResult = sm.simplifyCodes(actualResult);
	}
	assert.deepEqual(actualResult, expectedResult);
	done();
      } catch (e) {
	done(e);
      }
    });
  }
  
  // call assertResult several times in sequence, with shared format
  function assertResults(done, format, ...descsAndResults) {
    function next(err) {
      if (err) {
	done(err);
      } else {
	assertResults(done, format, ...descsAndResults);
      }
    }
    if (descsAndResults.length < 2) {
      done();
    } else {
      var description = descsAndResults.shift();
      var expectedResult = descsAndResults.shift();
      assertResult(next, format, description, expectedResult);
    }
  }

  // compute the MD5 sum of the contents of the named file
  function md5(filename) {
    var contents = fs.readFileSync(filename)
    return crypto.createHash('md5').update(contents).digest('hex');
  }

  // assert that evaluateDescription gives a file result with the file's :name
  // being "$TRIPS_BASE/etc/Spaceman/cache/$expectedName-720x360.gray", such
  // that the MD5 sum of the file's content is expectedMD5
  function assertGraphics(done, description, expectedName, expectedMD5) {
    var expectedPath = cacheDirParent + expectedName + '-720x360.gray';
    var expectedResult = {
      0: 'file',
      name: `"${KQML.escapeForQuotes(expectedPath)}"`,
      format: gray
    };
    function almostDone(err) {
      if (!err) {
	try {
	  assert.equal(md5(expectedPath), expectedMD5);
	  done();
	} catch (err) {
	  done(err);
	}
      } else {
	done(err);
      }
    }
    assertResult(almostDone, gray, description, expectedResult);
  }

  it('should fail on gibberish verbs', function(done) {
    assertResult(done, codeA2,
      ['sdlfkjsdfsdf', '"sdkfjsdf"'],
      errors.unknownAction('sdlfkjsdfsdf')
    );
  });

  //// IMPACT-derived stuff ////

  describe('impact', function() {
    it('should turn names to codes', function(done) {
      assertResults(done, codeI,
        ['impact', '"United States"'], 'USA',
        ['impact', '"South Sudan"'], 'SSD',
        ['impact', '"Azerbaijan"'], 'AZE'
      );
    });
    it('should fail on gibberish names', function(done) {
      assertResult(done, codeI,
        ['impact', '"jkshdfsdhfosdhfsdhfsj"'],
	errors.unknownObject(['impact', '"jkshdfsdhfosdhfsdhfsj"'])
      );
    });
    it('should fail on gibberish codes', function(done) {
      assertResult(done, codeI,
        ['impact', '"XYZ"'],
	errors.unknownObject(['impact', '"xyz"'])
      );
    });
  });

  describe('basin', function() {
    it('should turn names to codes', function(done) {
      assertResults(done, codeI,
        ['basin', '"Mississippi"'], 'MIS',
	['basin', '"Nile"'], 'NLL'
      );
    });
  });

  describe('fpu', function() {
    it('should handle the Rhine in Germany', function(done) {
      assertGraphics(done,
        ['fpu', '"RHI_DEU"'],
	'impact/FPU-RHI_DEU',
	'e08d36d462b252c1daacf5c295481b92'
      );
    });
    it('should fail on gibberish codes', function(done) {
      assertResult(done, codeI,
        ['fpu', '"sldkjfhsjdf"'],
	errors.unknownObject(['fpu', '"sldkjfhsjdf"'])
      );
    });
    it('should fail on non-FPU codes', function(done) {
      assertResults(done, codeI,
        ['fpu', '"NLL"'],
	errors.unknownObject(['fpu', '"nll"']),
        ['fpu', '"SSD"'],
	errors.unknownObject(['fpu', '"ssd"'])
      );
    });
  });

  describe('wd', function() {
    it('should find the whole world of countries', function(done) {
      assertGraphics(done,
	'WD',
	'WD',
	'8ebefeaea149f7a3131cf323be89e827'
      );
    });
  });

  //// ISO-derived stuff ////

  describe('iso', function() {
    it('should find countries', function(done) {
      assertResult(done, codeA2, ['iso', '"United States of America"'], 'US');
    });
    it('should find continents', function(done) {
      assertResult(done, codeA2,
        ['iso', '"Europe"'],
	'list AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK'.split(/ /)
      );
    });
    it('should find subcontinents', function(done) {
      assertResult(done, codeA2,
        ['iso', '"Western Europe"'],
	'list AT BE CH DE FR LI LU MC NL'.split(/ /)
      );
    });
    it('should fail on gibberish names', function(done) {
      assertResult(done, codeA2,
        ['iso', '"jkshdfsdhfosdhfsdhfsj"'],
	errors.unknownObject(['iso', '"jkshdfsdhfosdhfsdhfsj"'])
      );
    });
    // see continent, subcontinent, country for more specific tests
  });

  describe('continent', function() {
    it('should find continents', function(done) {
      assertResult(done, codeA2,
        ['continent', '"Europe"'],
	'list AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK'.split(/ /)
      );
    });
    it('should not find countries', function(done) {
      assertResult(done, codeA2,
        ['continent', '"United States of America"'],
	errors.unknownObject(['continent', '"united states of america"'])
      );
    });
    it('should not find subcontinents', function(done) {
      assertResult(done, codeA2,
        ['continent', '"Western Europe"'],
	errors.unknownObject(['continent', '"western europe"'])
      );
    });
  });

  describe('subcontinent', function() {
    it('should find subcontinents', function(done) {
      assertResult(done, codeA2,
        ['subcontinent', '"Western Europe"'],
	'list AT BE CH DE FR LI LU MC NL'.split(/ /)
      );
    });
    it('should not find countries', function(done) {
      assertResult(done, codeA2,
        ['subcontinent', '"United States of America"'],
	errors.unknownObject(['subcontinent', '"united states of america"'])
      );
    });
    it('should not find continents', function(done) {
      assertResult(done, codeA2,
        ['subcontinent', '"Europe"'],
	errors.unknownObject(['subcontinent', '"europe"'])
      );
    });
  });

  describe('country', function() {
    it('should turn country names to 2-letter codes', function(done) {
      assertResults(done, codeA2,
        ['country', '"France"'], 'FR',
	['country', '"Argentina"'], 'AR'
      );
    });
    it('should turn country names to 3-letter codes', function(done) {
      assertResults(done, codeA3,
        ['country', '"France"'], 'FRA',
	['country', '"Argentina"'], 'ARG'
      );
    });
    it('should turn country names to 3-digit codes', function(done) {
      assertResults(done, codeN3,
        ['country', '"France"'], '250',
	['country', '"Argentina"'], '032'
      );
    });
    it('should fail on gibberish names', function(done) {
      assertResult(done, codeA2,
        ['country', '"jkshdfsdhfosdhfsdhfsj"'],
	errors.unknownObject(['country', '"jkshdfsdhfosdhfsdhfsj"'])
      );
    });
    it('should translate 3-letter codes to 2-letter codes', function(done) {
      assertResult(done, codeA2, ['country', '"FRA"'], 'FR');
    });
  });

  describe('neighbors', function() {
    it('should handle a country with 0 neighbors', function(done) {
      assertResult(done, codeA2,
        ['neighbors', ['country', '"Australia"']],
	errors.unknownObject(['neighbors', ['country', '"Australia"']])
      );
    });
    it('should handle a country with 1 neighbor', function(done) {
      assertResult(done, codeA3,
        ['neighbors', ['country', '"South Korea"']], 'PRK'
      );
    });
    it('should handle a country with more than 1 neighbor', function(done) {
      assertResult(done, codeA2,
        ['neighbors', ['country', '"United States of America"']],
	'list CA MX'.split(/ /)
      );
    });
    it('should report an error in its argument', function(done) {
      assertResult(done, codeA2,
        ['neighbors', ['sdfsdf', '"sdkfjhsdkfsdf"']],
	errors.unknownAction('sdfsdf')
      );
    });
  });

  //// OSM-derived stuff ////
  
  describe('osm', function() {
    it('should handle United States', function(done) {
      this.timeout(5000); // for some reason this takes a while to fetch
      assertGraphics(done,
        ['osm', '"United States"'],
	'osm/united_states',
	'8a5763bee95eb7710c4b4ead5b1fc77d'
      );
    });
    it('should handle Georgia in the US', function(done) {
      assertGraphics(done,
        ['osm', '"Georgia"', '"US"'],
	'osm/georgia--us',
	'befddbd94aca534cca8d3cdfec666aec'
      );
    });
    it('should handle Georgia in Georgia', function(done) {
      assertGraphics(done,
        ['osm', '"Georgia"', '"GE"'],
	'osm/georgia--ge',
	'4a4e203d5ab4392e1d12f01963afeb84'
      );
    });
    it('should fail on gibberish names', function(done) {
      assertResult(done, gray,
        ['osm', '"sdkjfhskdfhskdfjhsd"'],
	errors.unknownObject(['osm', '"sdkjfhskdfhskdfjhsd"'])
      );
    });
    it('should fail on gibberish country codes', function(done) {
      assertResult(done, gray,
        ['osm', '"New York"', '"sdkjfhskdfhskdfjhsd"'],
	errors.unknownObject(['country', '"sdkjfhskdfhskdfjhsd"'])
      );
    });
  });

  describe('state', function() {
    it('should handle Georgia', function(done) {
      assertGraphics(done,
        ['state', '"Georgia"'],
	'osm/georgia--state',
	'befddbd94aca534cca8d3cdfec666aec'
      );
    });
    it('should handle New South Wales', function(done) {
      assertGraphics(done,
        ['state', '"New South Wales"'],
	'osm/new_south_wales--state',
	'17853d675e8e557ebf6ee2ea3f15ce4e'
      );
    });
  });

  describe('county', function() {
    it('should handle Ulster county in the US', function(done) {
      assertGraphics(done,
        ['county', '"Ulster"', '"US"'],
	'osm/ulster--county--us',
	'1895001ce399a04be3d092b6c6541dca'
      );
    });
    it('should handle county Cork in Ireland', function(done) {
      this.timeout(5000); // for some reason this takes a while to rasterize
      assertGraphics(done,
        ['county', '"Cork"', '"IE"'],
	'osm/cork--county--ie',
	'3d9e0d56d573d0e051a0138a32941b47'
      );
    });
    it('should handle Acadia parish', function(done) {
      assertGraphics(done,
        ['county', '"Acadia"'],
	'osm/acadia--county',
	'06fdcbaa196602bdd1fb0822379208d0'
      );
    });
  });

  //// shapes ////

  describe('box', function() {
    it('should handle an arbitrary box', function(done) {
      assertGraphics(done,
        ['box', -12, -34, 56, 78],
	'computed/[box---12---34--56--78]',
	'090e8169f8eabd82b715328ecfa00df0'
      );
    });
    it('should fail on non-numeric coordinates', function(done) {
      var desc = ['box', -12, 'barney', 56, 78];
      assertResult(done, gray,
        desc,
	errors.invalidArgument(desc, 2, 'number')
      );
    });
    it('should fail on coordinates out of bounds', function(done) {
      var desc = ['box', -12, -34, 560, 78];
      assertResult(done, gray,
        desc,
	errors.invalidArgument(desc, 3, 'number in [-180,180]')
      );
    });
    it('should fail on inverted coordinates', function(done) {
      assertResult(done, gray,
	['box', -12, 78, 56, -34],
	errors.invalidArgumentCombo('min > max')
      );
    });
  });

  describe('zone', function() {
    it('should handle the arctic', function(done) {
      assertGraphics(done,
        ['zone', 66, 90],
	'computed/[box---180--66--180--90]',
	'0b703754c2fba8ea26e0cbfca37413ac'
      );
    });
  });

  describe('lune', function() {
    it('should handle the western hemisphere', function(done) {
      assertGraphics(done,
        ['lune', -180, 0],
	'computed/[box---180---90--0--90]',
	'017749cc47b8c54255407ce5bfffbe45'
      );
    });
  });

  //// set operations ////

  // see also set-ops.js
  
  describe('intersection', function() {
    it('should handle Central American neighbors of Mexico', function(done) {
      assertResult(done, codeA3,
        ['intersection',
	  ['neighbors', ['country', '"Mexico"']],
	  ['subcontinent', '"Central America"']],
	['list', 'BLZ', 'GTM']
      );
    });
    it('should handle the only neighbor of both Canada and Mexico', function(done) {
      assertResult(done, codeA2,
        ['intersection',
	  ['neighbors', ['country', '"Canada"']],
	  ['neighbors', ['country', '"Mexico"']]],
	'US'
      );
    });
    it('should fail to find a neighbor of Canada in South America', function(done) {
      var desc =
        ['intersection',
	  ['neighbors', ['country', '"Canada"']],
	  ['subcontinent', '"South America"']];
      assertResult(done, codeA2,
        desc,
	errors.unknownObject(desc)
      );
    });
    it('should handle Arctic Russia', function(done) {
      assertGraphics(done,
        ['intersection', '"Russia"', ['zone', 66, 90]],
	'computed/[intersection--[box---180--66--180--90]--impact-Region-RUS]',
	'fdf2cc8209fd3a46b54e6a6c5bb1ed62'
      );
    });
  });

  describe('union', function () {
    it('should deduplicate the US', function(done) {
      assertResult(done, codeA2,
        ['union',
	  ['country', '"United States of America"'],
	  ['country', '"USA"']],
	'US'
      );
    });
    it('should report errors in multiple arguments', function(done) {
      assertResult(done, codeA2,
        ['union', ['country', '"qwertyuiop"'], ['country', '"asdfghjkl"']],
	{ 0: 'failure', type: 'cannot-perform', reason:
	  { 0: 'multiple', failures: [
	    errors.unknownObject(['country', '"qwertyuiop"']),
	    errors.unknownObject(['country', '"asdfghjkl"'])
	    ] } }
      );
    });
  });

  describe('complement', function() {
    it('should find Antarctica', function(done) {
      assertResult(done, codeA3,
        ['complement',
	  ['continent', '"Americas"'],
	  ['continent', '"Europe"'],
	  ['continent', '"Asia"'],
	  ['continent', '"Africa"'],
	  ['continent', '"Oceania"']
	  ],
	'list ATA ATF BVT HMD'.split(/ /)
      );
    });
  });

  describe('difference', function() {
    it('should subtract the US from Northern America', function(done) {
      assertResult(done, codeA2,
        ['difference',
	  ['subcontinent', '"Northern America"'],
	  ['country', '"USA"']],
	'list BM CA GL MX PM UM'.split(/ /)
      );
    });
  });

});
