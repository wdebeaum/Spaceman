'use strict';

const assert = require('assert');
const so = require('set-ops.js');

describe('collinear', function() {
  it('should return true for collinear points', function() {
    assert(so._collinear([0,0], [1,1], [4,4]));
    assert(so._collinear([4,4], [1,1], [0,0]));
    assert(so._collinear([5,0], [5,1], [5,4]));
    assert(so._collinear([0,-3], [1,-3], [4,-3]));
  });
  it('should return false for left turns', function() {
    assert(!so._collinear([0,0],[1,0],[1,1]));
  });
  it('should return false for right turns', function() {
    assert(!so._collinear([0,0],[0,1],[1,1]));
  });
});

// NOTE: assumes binSize == 2
describe('edgeToBins', function() {
  it('should return only the bin that an edge in only one bin is in', function() {
    assert.deepEqual(so._edgeToBins([1,1],[1.5,1.5]), [[0,0]]);
    assert.deepEqual(so._edgeToBins([12.5,42.5],[13,43]), [[6,21]]);
  });
  it('should give bin corners to the bin they are the minimum corner for', function() {
    // NE [+,+]
    assert.deepEqual(so._edgeToBins([1,1],[3,3]), [[0,0],[1,1]]);
    // SW [-,-]
    assert.deepEqual(so._edgeToBins([3,3],[1,1]), [[1,1],[0,0]]);
    // SE [+,-]
    assert.deepEqual(so._edgeToBins([1,3],[3,1]), [[0,1],[1,1],[1,0]]);
    // NW [-,+]
    assert.deepEqual(so._edgeToBins([3,1],[1,3]), [[1,0],[1,1],[0,1]]);
  });
  it('should give bin edges to the bin they are the minimum for', function() {
    assert.deepEqual(so._edgeToBins([2,2], [5,2]), [[1,1], [2,1]]);
    assert.deepEqual(so._edgeToBins([2,2], [2,5]), [[1,1], [1,2]]);
  });
  // all directed radii of a 4x4 bin square (this should cover all relevant
  // cases of slopes):
  it('should handle E', function() {
    assert.deepEqual(so._edgeToBins([-4,0], [4,0]),
      [[-2,0],[-1,0],[0,0],[1,0],[2,0]]);
  });
  it('should handle W', function() {
    assert.deepEqual(so._edgeToBins([4,0], [-4,0]),
      [[2,0],[1,0],[0,0],[-1,0],[-2,0]]);
  });
  it('should handle ENE', function() {
    assert.deepEqual(so._edgeToBins([-4,-2], [4,2]),
      [[-2,-1],[-1,-1],[0,0],[1,0],[2,1]]);
  });
  it('should handle WSW', function() {
    assert.deepEqual(so._edgeToBins([4,2], [-4,-2]),
      [[2,1],[1,0],[0,0],[-1,-1],[-2,-1]]);
  });
  it('should handle NE', function() {
    assert.deepEqual(so._edgeToBins([-4,-4],[4,4]),
      [[-2,-2],[-1,-1],[0,0],[1,1],[2,2]]);
  });
  it('should handle SW', function() {
    assert.deepEqual(so._edgeToBins([4,4],[-4,-4]),
      [[2,2],[1,1],[0,0],[-1,-1],[-2,-2]]);
  });
  it('should handle NNE', function() {
    assert.deepEqual(so._edgeToBins([-2,-4],[2,4]),
      [[-1,-2],[-1,-1],[0,0],[0,1],[1,2]]);
  });
  it('should handle SSW', function() {
    assert.deepEqual(so._edgeToBins([2,4],[-2,-4]),
      [[1,2],[0,1],[0,0],[-1,-1],[-1,-2]]);
  });
  it('should handle N', function() {
    assert.deepEqual(so._edgeToBins([0,-4],[0,4]),
      [[0,-2],[0,-1],[0,0],[0,1],[0,2]]);
  });
  it('should handle S', function() {
    assert.deepEqual(so._edgeToBins([0,4],[0,-4]),
      [[0,2],[0,1],[0,0],[0,-1],[0,-2]]);
  });
  it('should handle NNW', function() {
    assert.deepEqual(so._edgeToBins([2,-4],[-2,4]),
      [[1,-2],[0,-2],[0,-1],[0,0],[-1,0],[-1,1],[-1,2]]);
  });
  it('should handle SSE', function() {
    assert.deepEqual(so._edgeToBins([-2,4],[2,-4]),
      [[-1,2],[-1,1],[-1,0],[0,0],[0,-1],[0,-2],[1,-2]]);
  });
  it('should handle NW', function() {
    assert.deepEqual(so._edgeToBins([4,-4],[-4,4]),
      [[2,-2],[1,-2],[1,-1],[0,-1],[0,0],[-1,0],[-1,1],[-2,1],[-2,2]]);
  });
  it('should handle SE', function() {
    assert.deepEqual(so._edgeToBins([-4,4],[4,-4]),
      [[-2,2],[-2,1],[-1,1],[-1,0],[0,0],[0,-1],[1,-1],[1,-2],[2,-2]]);
  });
  it('should handle WNW', function() {
    assert.deepEqual(so._edgeToBins([4,-2],[-4,2]),
      [[2,-1],[1,-1],[0,-1],[0,0],[-1,0],[-2,0],[-2,1]]);
  });
  it('should handle ESE', function() {
    assert.deepEqual(so._edgeToBins([-4,2],[4,-2]),
      [[-2,1],[-2,0],[-1,0],[0,0],[0,-1],[1,-1],[2,-1]]);
  });
  it('should handle general cases', function() {
    assert.deepEqual(so._edgeToBins([23.5,6.3],[-2.4,9]),
      [[11,3],[10,3],[9,3],[8,3],[7,3],[6,3],[5,3],[4,3],[3,3],
       [3,4],[2,4],[1,4],[0,4],[-1,4],[-2,4]]
    );
    assert.deepEqual(so._edgeToBins([10, 0], [5, 10]),
      [[5,0],
       [4,0],[4,1],[4,2],
       [3,2],[3,3],[3,4],
       [2,4],[2,5]]
    );
  });
});

describe('buildEdgeDict', function() {
  it('should handle a pair of intersecting squares', function() {
    assert.deepEqual(
      so._buildEdgeDict([
	[[0,0],[4,0],[4,4],[0,4],[0,0]],
	[[2,2],[6,2],[6,6],[2,6],[2,2]]
      ]),
      /* 3     1  1  1		3    3     2
       * 2 0  01 0   1		2 3     2
       * 1 0   1 01  1		1    04    1
       * 0 0  0  0		0 04    1
       *   0  1  2  3		  0  1  2  3
       */
      { "[0,0]": [ { ring: 0, start: 0, end: 1 }, { ring: 0, start: 3, end: 4 } ], // TODO merge start and end of ring?
	"[1,0]": [ { ring: 0, start: 0, end: 1 } ],
	"[2,0]": [ { ring: 0, start: 0, end: 2 } ],
	// nothing in [3,0]
	"[0,1]": [ { ring: 0, start: 3, end: 4 } ],
	"[1,1]": [ { ring: 1, start: 0, end: 1 }, { ring: 1, start: 3, end: 4 } ], // TODO see above
	"[2,1]": [ { ring: 0, start: 1, end: 2 }, { ring: 1, start: 0, end: 1 } ],
	"[3,1]": [ { ring: 1, start: 0, end: 2 } ],
	"[0,2]": [ { ring: 0, start: 2, end: 4 } ],
	"[1,2]": [ { ring: 0, start: 2, end: 3 }, { ring: 1, start: 3, end: 4 } ],
	"[2,2]": [ { ring: 0, start: 1, end: 3 } ],
	"[3,2]": [ { ring: 1, start: 1, end: 2 } ],
	// nothing in [0,3]
	"[1,3]": [ { ring: 1, start: 2, end: 4 } ],
	"[2,3]": [ { ring: 1, start: 2, end: 3 } ],
	"[3,3]": [ { ring: 1, start: 1, end: 3 } ]
      }
    );
  });
});

describe('edgeIntersections', function() {
  /* template
    assert.deepEqual(
      so._edgeIntersections(
	{ prevFrom: [,], from: [,], to: [,], nextTo: [,] },
	{ prevFrom: [,], from: [,], to: [,], nextTo: [,] }
      ),
      [
	{ point: [,], edges: [
	  ]
	},
      ]
    );
  */
  it('should return [] when there is no intersection', function() {
    assert.deepEqual(
      so._edgeIntersections(
	{ prevFrom: [0,0], from: [1,2], to: [3,4], nextTo: [0,0] },
	{ prevFrom: [0,0], from: [9,8], to: [7,6], nextTo: [0,0] }
      ),
      []
    );
  });
  it('should return a single point when edges cross', function() {
    assert.deepEqual(
      so._edgeIntersections(
	{ prevFrom: [0,0], from: [1,1], to: [2,2], nextTo: [0,0] },
	{ prevFrom: [0,0], from: [1,2], to: [2,1], nextTo: [0,0] }
      ),
      [
	{ point: [1.5,1.5], edges: [
	    { prevFrom: [0,0], from: [1,1], to: [2,2], nextTo: [0,0] },
	    { prevFrom: [0,0], from: [1,2], to: [2,1], nextTo: [0,0] }
	  ]
	}
      ]
    );
  });
  it("should return two points when edges overlap and have each other's froms",
     function() {
    assert.deepEqual(
      so._edgeIntersections(
	{ prevFrom: [42,57], from: [2,2], to: [4,4], nextTo: [42,57] },
	{ prevFrom: [112,358], from: [3,3], to: [1,1], nextTo: [112,358] }
      ),
      [
	{ point: [2,2], edges: [
	    { prevFrom: [42,57], from: [2,2], to: [4,4], nextTo: [42,57] },
	    { prevFrom: [112,358], from: [3,3], to: [1,1], nextTo: [112,358] }
	  ]
	},
	{ point: [3,3], edges: [
	    { prevFrom: [42,57], from: [2,2], to: [4,4], nextTo: [42,57] },
	    { prevFrom: [112,358], from: [3,3], to: [1,1], nextTo: [112,358] }
	  ]
	}
      ]
    );
  });
  // TODO lots more cases
});

describe('findEdgeIntersections', function() {
  it('should find intersections among a set of edges', function() {
    assert.deepEqual(
      so._findEdgeIntersections([
	{ prevFrom: [0,0], from: [1,2], to: [3,4], nextTo: [0,0] },
	{ prevFrom: [0,0], from: [9,8], to: [7,6], nextTo: [0,0] },
	{ prevFrom: [0,0], from: [1,1], to: [2,2], nextTo: [0,0] },
	{ prevFrom: [0,0], from: [1,2], to: [2,1], nextTo: [0,0] }
      ]),
      [
        { point: [1,2], edges: [
	  { prevFrom: [0,0], from: [1,2], to: [3,4], nextTo: [0,0] },
	  { prevFrom: [0,0], from: [1,2], to: [2,1], nextTo: [0,0] }
	  ]
	},
	{ point: [1.5,1.5], edges: [
	    { prevFrom: [0,0], from: [1,1], to: [2,2], nextTo: [0,0] },
	    { prevFrom: [0,0], from: [1,2], to: [2,1], nextTo: [0,0] }
	  ]
	}
      ]
    );
  });
});

describe('findRingIntersections', function() {
  it('should handle a pair of intersecting squares', function() {
    assert.deepEqual(
      so._findRingIntersections([
	// see also buildEdgeDict test
	[[0,0],[4,0],[4,4],[0,4],[0,0]],
	[[2,2],[6,2],[6,6],[2,6],[2,2]]
      ]),
      [
        [ { ring: 0, edge: 1, point: [4,2] },
	  { ring: 1, edge: 0, point: [4,2] } ],
	[ { ring: 0, edge: 2, point: [2,4] },
	  { ring: 1, edge: 3, point: [2,4] } ]
      ]
    );
  });
});

describe('pointIsInRing', function() {
  var sq = [[0,0],[1,0],[1,1],[0,1],[0,0]];
  var hole = [[0,0],[0,1],[1,1],[1,0],[0,0]];
  var diamond = [[0,0],[0.5,-0.5],[1,0],[0.5,0.5],[0,0]];
  var inside = [0.5,0.5];
  var outside = [-1,0.5];
  var outside2 = [0.5,-1];
  it('should be true inside a square', function() {
    assert(so._pointIsInRing(inside, sq));
  });
  it('should be false outside a square', function() {
    assert(!so._pointIsInRing(outside, sq));
    assert(!so._pointIsInRing(outside2, sq));
  });
  it('should be false inside a hole', function() {
    assert(!so._pointIsInRing(inside, hole));
  });
  it('should be true outside a hole', function() {
    assert(so._pointIsInRing(outside, hole));
    assert(so._pointIsInRing(outside2, hole));
  });
  it('should be false outside a diamond just S of the test ray', function() {
    assert(!so._pointIsInRing(outside, diamond));
  });
});

describe('pointIsInRingBoolean', function() {
  // TODO
});

describe('evaluateIndexBoolean', function() {
  it('should handle nested formulas', function() {
    for (var i = 0; i < 8; i++) {
      var b0 = ((i&1)>0);
      var b1 = ((i&2)>0);
      var b2 = ((i&4)>0);
      assert.strictEqual(
	so._evaluateIndexBoolean(
	  { operator: 'or', operands: [
	    { operator: 'and', operands: [0,1] },
	    { operator: 'and', operands: [1,2] }
	  ]},
	  [b0, b1, b2]
	),
	((b0 && b1) || (b1 && b2))
      );
    }
  });
});

function ringBooleanBounds(ringBoolean) {
  if (Array.isArray(ringBoolean)) {
    // start with NaN bounds
    var min = [0/0, 0/0];
    var max = [0/0, 0/0];
    ringBoolean.forEach(point => {
      // NOTE: we do e.g. !(point >= min) instead of point < min so that when
      // min is NaN the test succeeds
      if (!(point[0] >= min[0])) { min[0] = point[0]; }
      if (!(point[1] >= min[1])) { min[1] = point[1]; }
      if (!(point[0] <= max[0])) { max[0] = point[0]; }
      if (!(point[1] <= max[1])) { max[1] = point[1]; }
    });
    return { min: min, max: max };
  } else {
    var bounds = [];
    ringBoolean.operands.forEach(o => {
      var b = ringBooleanBounds(o);
      bounds.push(b.min, b.max);
    });
    return ringBooleanBounds(bounds); // cheating
  }
}

/* Assert that two ring booleans divide the plane into the same set of interior
 * and exterior points. Tests all points with coordinates k + 0.5 where k is an
 * integer, within the bounding rectangle of all rings in either set, expanded
 * by 1 in all directions.
 */
function assertRingBooleansEqual(actual, expected) {
  // find bounding rectangle
  var bounds = ringBooleanBounds({ operands: [actual, expected] });
  var min = bounds.min;
  var max = bounds.max;
  // expand
  min[0]--; min[1]--; max[0]++; max[1]++;
  // test each point
  for (var y = Math.floor(min[1] - 0.5) + 0.5; y <= max[1]; y++) {
    for (var x = Math.floor(min[0] - 0.5) + 0.5; x <= max[0]; x++) {
      var point = [x,y];
      var a = so._pointIsInRingBoolean(point, actual);
      var e = so._pointIsInRingBoolean(point, expected);
      assert.strictEqual(a, e,
	`expected point ${JSON.stringify(point)} to be ${e ? 'in' : 'out'}side, but it was ${a ? 'in' : 'out'}side`
      );
    }
  }
}

function assertEvaluateRingBooleanWorks(rb, expectedNumPolygons) {
  var actualGJ = so._evaluateRingBoolean(rb);
  if (expectedNumPolygons !== undefined) {
    var actualNumPolygons = (actualGJ.type == 'Polygon' ? 1 : actualGJ.coordinates.length);
    assert((actualNumPolygons == expectedNumPolygons), `expected ${expectedNumPolygons} polygons, but got ${actualNumPolygons}`);
  }
  assertRingBooleansEqual(so._gjToRingBoolean(actualGJ), rb);
}

describe('evaluateRingBoolean', function() {
  var tri1 = [[0,0],[10,0],[5,10],[0,0]];
  var tri2 = [[10,10],[20,10],[15,20],[10,10]];
  var sq1 = [[0,0],[4,0],[4,4],[0,4],[0,0]];
  var sq2 = [[2,2],[6,2],[6,6],[2,6],[2,2]];
  var sq3 = [[3,3],[3,5],[5,5],[5,3],[3,3]]; // hole in the middle of sq2
  var sq4 = [[4,0],[8,0],[8,4],[4,4],[4,0]]; // shared boundary with sq1
  it('should leave a single polygon alone', function() {
    assertEvaluateRingBooleanWorks(tri1);
  });
  it('should leave union of non-intersecting polygons alone', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [tri1, tri2] });
  });
  it('should leave a square with a hole in it alone', function() {
    assertEvaluateRingBooleanWorks({ operator: 'and', operands: [sq2, sq3] });
  });
  it('should leave a square with a hole-like concavity alone', function() {
    /* ####
     * #  #
     * #  #
     * ###
     */
    assertEvaluateRingBooleanWorks({ operator: 'and', operands: [
      [[3,1],[4,1],[4,4],[0,4],[0,0],[3,0],[3,1],
       [1,1],[1,3],[3,3],[3,1]]
    ]});
  });
  it('should do a simple intersection of squares', function() {
    assertEvaluateRingBooleanWorks({ operator: 'and', operands: [sq1, sq2] });
  });
  it('should eliminate the shared boundary of unioned adjacent squares', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [sq1, sq4] }, 1);
  });
  it('should intersect a square with a donut', function() {
    assertEvaluateRingBooleanWorks({ operator: 'and', operands: [sq1, sq2, sq3] });
  });
  // a theory on why flaherty island broke
  it('should handle a necklace with a donut pendant', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [
      // necklace
      [[-3,-3],[-2,-3],[-2,-2],[-3,-2],[-3,-3]],
      [[-2,-4],[-1,-4],[-1,-3],[-2,-3],[-2,-4]],
      [[-1,-5],[1,-5],[1,-4],[-1,-4],[-1,-5]],
      [[1,-4],[2,-4],[2,-3],[1,-3],[1,-4]],
      [[2,-3],[3,-3],[3,-2],[2,-2],[2,-3]],
      // donut pendant
      { operator: 'and', operands: [
        [[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]],
	[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]
      ]},
    ]});
  });
  // another theory
  it('should handle a donut with sprinkles', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [
      // sprinkles
      [[-3,-3],[-2,-3],[-2,-2],[-3,-2],[-3,-3]],
      [[2,-3],[3,-3],[3,-2],[2,-2],[2,-3]],
      // donut pendant
      { operator: 'and', operands: [
        [[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]],
	[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]
      ]},
    ]});
  });
  it('should eliminate redundant intersection operands', function() {
    assertEvaluateRingBooleanWorks({ operator: 'and', operands: [
      [[-3,-3],[3,-3],[3,3],[-3,3],[-3,-3]], // outer, redundant
      [[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]], // inner
      [[-1,-1],[-1,1],[1,1],[1,-1],[-1,-1]] // hole in inner
    ]}, 1);
  });
  function pixel(x,y) { return [[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]; }
  // yet another theory
  it('should handle glasses', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [
      pixel(-3,1), pixel(-2,0), pixel(-2,2), pixel(-1,1),
      pixel(0,0), //	      v ^ these are missing from result
      pixel(3,1), pixel(2,0), pixel(2,2), pixel(1,1),
    ]});
  });
  it('should handle a caret', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [
      pixel(0,0), pixel(1,1), pixel(2,0)
    ]});
  });
  it('should handle a triforce', function() {
    assertEvaluateRingBooleanWorks({ operator: 'or', operands: [
      [[2,0],[0,2],[-2,0],[2,0]], // top triangle
      [[-2,0],[-4,-2],[0,-2],[-2,0]], // bottom left triangle
      [[2,0],[0,-2],[4,-2],[2,0]] // bottom right triangle
    ]});
  });
  // TODO more tests
});

describe('ringBooleanToIndexBoolean', function() {
  it('should handle some squares', function() {
    var sq1 = [[0,0],[4,0],[4,4],[0,4],[0,0]];
    var sq2 = [[2,2],[6,2],[6,6],[2,6],[2,2]];
    var sq3 = [[3,3],[3,5],[5,5],[5,3],[3,3]]; // hole in the middle of sq2
    var rings = [];
    var ib =
      so._ringBooleanToIndexBoolean(
	{ operator: 'or',
	  operands: [
	    sq1,
	    { operator: 'and', operands: [sq2, sq3] }
	  ]
	},
	rings
      );
    assert.deepEqual(rings, [sq1, sq2, sq3]);
    assert.deepEqual(ib,
      { operator: 'or',
	operands: [
	  0,
	  { operator: 'and', operands: [1, 2] }
	]
      }
    );
  });
});

describe('gjToRingBoolean', function() {
  it('should handle a square', function() {
    var sq1 = [[0,0],[4,0],[4,4],[0,4],[0,0]];
    var gj = { type: 'Polygon', coordinates: [sq1] };
    assert.deepEqual(so._gjToRingBoolean(gj), sq1);
  });
  it('should handle a square with a hole', function() {
    var sq2 = [[2,2],[6,2],[6,6],[2,6],[2,2]];
    var sq3 = [[3,3],[3,5],[5,5],[5,3],[3,3]]; // hole in the middle of sq2
    var gj = { type: 'Polygon', coordinates: [sq2, sq3] };
    assert.deepEqual(so._gjToRingBoolean(gj),
      { operator: 'and', operands: [sq2, sq3] }
    );
  });
  it('should handle two squares', function() {
    var sq4 = [[0,0],[1,0],[1,1],[0,1],[0,0]];
    var sq5 = [[2,0],[3,0],[3,1],[2,1],[2,0]];
    var gj = { type: 'MultiPolygon', coordinates: [[sq4], [sq5]] };
    assert.deepEqual(so._gjToRingBoolean(gj),
      { operator: 'or', operands: [sq4, sq5] }
    );
  });
  it('should fix ring windings in polygons', function() {
    var sq2 = [[2,2],[6,2],[6,6],[2,6],[2,2]];
    var sq3 = [[3,3],[3,5],[5,5],[5,3],[3,3]]; // hole in the middle of sq2
    var rsq2 = sq2.slice().reverse();
    var rsq3 = sq3.slice().reverse();
    var gj = { type: 'Polygon', coordinates: [rsq2, rsq3] };
    assert.deepEqual(so._gjToRingBoolean(gj),
      { operator: 'and', operands: [sq2, sq3] }
    );
  });
});

describe('complementRingBoolean', function() {
  var sq1 = [[0,0],[4,0],[4,4],[0,4],[0,0]];
  var sq2 = [[2,2],[6,2],[6,6],[2,6],[2,2]];
  var rsq1 = [[0,0],[0,4],[4,4],[4,0],[0,0]];
  var rsq2 = [[2,2],[2,6],[6,6],[6,2],[2,2]];
  it('should reverse a square', function() {
    assert.deepEqual(so._complementRingBoolean(sq1), rsq1);
  });
  it("should apply De Morgan's Law", function() {
    assert.deepEqual(
      so._complementRingBoolean({ operator: 'and', operands: [sq1, sq2] }),
      { operator: 'or', operands: [rsq1, rsq2] }
    );
  });
});

// TODO exported functions
