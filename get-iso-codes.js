// NO LONGER USED
// We get countries.json from github mledoze/countries instead, because it
// includes information on land border adjacencies, and generally has more
// alternative names for countries.
'use strict';

const https = require('https');

// From "The International Model for Policy Analysis of Agricultural
// Commoddities and Trade (IMPACT): Model Description for Version 3", Appendix
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
  { impactCode: 'SDN', impactName: 'Sudan Plus',
    isoCodes: ['SDN', 'SSD'] },
  { impactCode: 'SPP', impactName: 'Spain Plus',
    isoCodes: ['AND', 'ESP', 'GIB'] },
  { impactCode: 'UKP', impactName: 'Great Britain Plus',
    isoCodes: ['GBR', 'GGY', 'IMN'] }
];
// TODO? also use Table C.4 Standard IMPACT regional aggregations (names in note at bottom of table instead of in table)

/* Call cb with the wiki text from the Wikipedia article with the given title.*/
function getWikiText(title, cb) {
  https.get('https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvlimit=1&rvprop=content&format=json&titles=' + title, (res) => {
    // TODO error handling
    res.setEncoding('utf-8');
    var data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      var json = JSON.parse(data);
      for (var pageID in json.query.pages) {
	var wikitext = json.query.pages[pageID].revisions[0]['*'];
	cb(wikitext);
      }
    });
  });
}

// fetch ISO 3166-1 country codes from Wikipedia
// TODO ISO 3166-2 country subdivision codes
getWikiText('ISO_3166-1', (wt) => {
  var headingIdx = wt.indexOf("===Officially assigned code elements===\n");
  var tableIdx = wt.indexOf("| [[Afghanistan]]\n", headingIdx);
  var endIdx = wt.indexOf("\n=", tableIdx);
  var tableRows = wt.substring(tableIdx, endIdx).split(/\n\|-\n/);
  console.log("2L\t3L\t3D\tIMPACT\tnames...");
  tableRows.forEach((row) => {
    var names;
    var m = /^\| \[\[([^\|\]]+)\|([^\]]+)\]\]/.exec(row); // [[foo|bar]]
    if (m) {
      names = [m[1],m[2]];
      // TODO handle [[foo|bar (baz of the)]]
    } else {
      m = /^\| \[\[([^\|\]]+)\]\]/.exec(row); // [[foo]]
      if (m) {
	names = [m[1].replace(/<!--.*?-->/g,'')]; // remove comment about Taiwan
      } else {
	// {{sort|foo|[[bar]]}}
	m = /^\| {{sort\|([^\|\]]+)\|\[\[([^\]]+)\]\]}}/.exec(row);
	if (m) {
	  names = [m[1],m[2]];
	} else {
	  throw "bogus row:\n" + row;
	}
      }
    }
    var newNames = [];
    names.forEach((name) => {
      // "foo (bar of the)" => "bar of the foo"
      var m = /^([^\(\)]+?) \(([^\)]+? of(?: the)?)\)$/.exec(name);
      if (m) {
	newNames.push(m[2] + ' ' + m[1]);
      }
      // "foo (bar) baz" => "foo baz"
      m = /^([^\(\)]+?) \([^\)]+\)(.*)$/.exec(name);
      if (m) {
	newNames.push(m[1] + m[2]);
      }
      // "foo, bar of the" => "bar of the foo", "foo"
      m = /^([^,]+), (.+? of(?: the)?)$/.exec(name);
      if (m) {
	newNames.push(m[2] + ' ' + m[1]);
	newNames.push(m[1]);
      }
      // TODO? "foo, bar and baz" => "foo", "bar", "baz"
    });
    var codeRE = /{{mono\|(...?)}}/g;
    var twoLetter = codeRE.exec(row)[1];
    var threeLetter = codeRE.exec(row)[1];
    var threeDigit = codeRE.exec(row)[1];
    var merger = impactMergers.find((x) => x.isoCodes.includes(threeLetter));
    var impact = (merger ? merger.impactCode : threeLetter);
    if (merger) {
      newNames.push(merger.impactName);
    }
    names = [...new Set(names.concat(newNames))];
    // TODO fetch subdivisions from 'ISO_3166-1:' + twoLetter?
    var columns = [twoLetter, threeLetter, threeDigit, impact, ...names];
    console.log(columns.join("\t"));
  });
});
