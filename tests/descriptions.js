'use strict';

const assert = require('assert');
const errors = require('util/cwc/errors.js');
const Spaceman = require('Spaceman.js');

// disable sending messages, to avoid cluttering stdout
Spaceman.prototype.sendMsg = function() {}

describe('evaluateDescription', function() {
  // shorthand code formats
  var codeI = ['code', '"IMPACT"'];
  var codeA2 = ['code', 'ISO 3166-1 alpha-2'];
  var codeA3 = ['code', 'ISO 3166-1 alpha-3'];
  var codeN3 = ['code', 'ISO 3166-1 numeric'];

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

  // TODO assertions for testing graphical results, needed for fpu, OSM stuff, and shapes

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
    // TODO non-trivial test of successful case (requires graphics, since FPUs don't have names, only codes)
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
  
  // TODO osm, state, county

  //// shapes ////

  // TODO box, zone, lune

  //// set operations ////

  // see also set-ops.js
  
  // TODO code set operations

});
