/* set-ops.js - implement set operations on GeoJSON (Multi)Polygons
 *
 * GeoJSON terminology is used here, so a "ring" is what you might normally
 * consider a polgygon (with no holes), and a "polygon" is one ring with
 * counterclockwise winding in the (easting, northing) coordinate system,
 * followed by zero or more rings with clockwise winding representing the holes
 * in the polygon.
 */
'use strict';

/* A rectangle covering the whole Earth's surface. The "universe" in set theory
 * terms.
 */
const globe = {
  type: 'Polygon',
  coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]
};

const binSize = 2; // degrees
const equatorRadius = 637813700; // cm
const epsilon = 180 / (Math.PI * equatorRadius); // 1cm @ Equator, in degrees

//
// equality predicates
//

function numbersWithinEpsilon(a, b) {
  return Math.abs(a - b) <= epsilon;
}

function pointsWithinEpsilon(a, b) {
  return numbersWithinEpsilon(a[0], b[0]) && numbersWithinEpsilon(a[1], b[1]);
}

function binsEqual(a, b) {
  // NOTE: bin coords are integers, so no epsilon needed
  return a[0] == b[0] && a[1] == b[1];
}

//
// point math
//

function addv(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function subv(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale(vec, scal) {
  return [vec[0] * scal, vec[1] * scal];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function distanceSquared(a, b) {
  var displacement = subv(a, b);
  return dot(displacement, displacement);
}

function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function collinear(a, b, c) {
  // a, b, and c are collinear iff (b-a)x(c-a)==0
  var bDisp = subv(b, a);
  var cDisp = subv(c, a);
  return numbersWithinEpsilon(cross(bDisp, cDisp), 0);
}

//
// binning
//

/* Return the bin containing the given point. Note that bins are half-open
 * intervals along each dimension (the max side is open, as are three of the
 * corners; only the min corner is closed).
 */
function pointToBin(point) {
  return [Math.floor(point[0]/binSize), Math.floor(point[1]/binSize)];
}

/* Return an Array of bins that the edge from from to to intersects, in order.*/
function edgeToBins(from, to) {
  var fromBin = pointToBin(from);
  var toBin = pointToBin(to);
  var displacement = subv(to, from);
  var slope = displacement[1] / displacement[0];
  var xInc = Math.sign(displacement[0]);
  var yInc = Math.sign(displacement[1]);
  var dCorner =
    [(0.5 + 0.5 * xInc) * binSize - from[0],
     (0.5 + 0.5 * yInc) * binSize - from[1]];
//  console.log({ fromBin: fromBin, toBin: toBin, displacement: displacement, slope: slope, inc: [xInc, yInc], dCorner: dCorner });
  var bins = [fromBin];
  var lastBin = fromBin;
  while (!binsEqual(lastBin, toBin)) {
//    console.log({ lastBin: lastBin });
    var nextBin = [lastBin[0], lastBin[1]];
    if (xInc == 0) {
      nextBin[1] += yInc;
    } else if (yInc == 0) {
      nextBin[0] += xInc;
    } else {
      // the corner between lastBin and the next diagonal bin, relative to from
      var c =
        addv(scale(lastBin, binSize), dCorner);
      // make sure zero denominator has correct sign
      if (c[0] == 0) { c[0] = xInc * 0; }
      var cs = c[1] / c[0];
      var slopeCmp = Math.sign(cs - slope);
//      console.log({ c: c, cs: cs, slopeCmp: slopeCmp });
      if (slopeCmp == 0 || // edge goes through c
	  Number.isNaN(slopeCmp)) { // edge starts at c
	if (xInc == yInc) { // [+,+] or [-,-]
	  // inc both x and y, since c belongs to either current or next bin
	  // already
	  nextBin[0] += xInc;
	  nextBin[1] += yInc;
	// if the incs are opposite, do the positive one first, since c belongs
	// to the bin for which it is the minimum
	} else if (xInc == 1) { // [+,-]
	  //from^            ^
	  //  \ |         #1#|#2#
	  //   \|         ###|###
	  // ---c---> =>  ---c--->
	  //    |\|          |###
	  //    | to         |#3#
	  // ...because c belongs to bin #2.
	  nextBin[0] += xInc;
	} else { // [-,+]
	  nextBin[1] += yInc;
	}
      } else if (slopeCmp == xInc * yInc) {
	nextBin[0] += xInc;
      } else {
	nextBin[1] += yInc;
      }
    }
//    console.log({ nextBin: nextBin });
//    if (nextBin[1] > 10 || nextBin[1] < -10 || nextBin[0] > 10 || nextBin[0] < -10) { throw new Error("WTF"); }
    bins.push(nextBin);
    lastBin = nextBin;
  }
  return bins;
}

//
// edge dictionary
//

/* Like o[k].push(v), except it creates the Array at o[k] if necessary. */
function pushToProp(o, k, v) {
  if (k in o) {
    o[k].push(v);
  } else {
    o[k] = [v];
  }
}

/* Given an Array of rings, return an Object mapping each spatial bin key to an
 * Array of Objects that identify a portion of a ring that passes through the
 * bin. Those objects have three fields:
 * .ring - index of the ring
 * .start - index of the point in the ring before the first edge that
 * intersects the bin
 * .end - index of the point in the ring after the last edge that intersects
 * the bin
 */
function buildEdgeDict(rings) {
  var edgeDict = {};
  rings.forEach((ring, i) => {
//    console.log({ i: i, ring: ring });
    var lastSegment = { ring: i, start: 0, end: 1 };
    var lastBinKey = JSON.stringify(pointToBin(ring[0]));
    pushToProp(edgeDict, lastBinKey, lastSegment);
    for (var j = 1; j < ring.length; j++) {
//      console.log({ from: ring[j-1], to: ring[j] });
      var bins = edgeToBins(ring[j-1], ring[j]);
//      console.log({ bins: bins });
      lastSegment.end = j;
      for (var k = 1; k < bins.length; k++) {
//	console.log({ j: j, k: k });
	lastSegment = { ring: i, start: j-1, end: j };
	lastBinKey = JSON.stringify(bins[k]);
	pushToProp(edgeDict, lastBinKey, lastSegment);
      }
    }
  });
  return edgeDict;
}

//
// finding boundary intersections
//

function reverseEdge(e) {
  return { prevFrom: e.nextTo, from: e.to, to: e.from, nextTo: e.prevFrom };
}

function edgesWithinEpsilon(a, b) {
  return (pointsWithinEpsilon(a.prevFrom, b.prevFrom) &&
	  pointsWithinEpsilon(a.from, b.from) &&
	  pointsWithinEpsilon(a.to, b.to) &&
	  pointsWithinEpsilon(a.nextTo, b.nextTo));
}

/* Given two edges, return an Array containing 0, 1, or 2 intersections. Edges
 * are Objects with at least the following fields:
 * .from - the first point of the edge
 * .to - the last point of the edge (not considered to be included in the edge)
 * .prevFrom - the .from of the previous edge in the ring
 * .nextTo - the .to of the next edge in the ring
 * Intersections are Objects with the following fields:
 * .point - the point of intersection
 * .edges - an Array of edges that include that point (i.e. [a,b])
 * If the edges overlap at more than just a point, the returned Array may
 * contain up to two intersections, the endpoints of the overlap. But each
 * endpoint will only be output if it is the start of a chain of overlaps,
 * rather than the end or a point in the middle of such a chain. This is what
 * the .prevFrom and .nextTo fields are used for. (The end of a chain of
 * overlaps will still be output as a regular single-point intersection with
 * the edge after the chain when it is passed to this function.) Really the
 * goal is to output points of interest to the larger algorithm, rather than
 * absolutely all intersections.
 */
function edgeIntersections(a, b) {
  // shortcut identical and reverse identical edges, including neighborhoods
  if (edgesWithinEpsilon(a, b)) { return []; }
  var bReverse = reverseEdge(b);
  if (edgesWithinEpsilon(a, bReverse)) { return []; }
  var aDisp = subv(a.to, a.from);
  var bDisp = subv(b.to, b.from);
  var dispCross = cross(aDisp, bDisp);
  var fromDisp = subv(b.from, a.from);
  var fromCrossB = cross(fromDisp, bDisp);
  if (dispCross == 0) { // parallel
    if (fromCrossB == 0) { // collinear
      var aDisp2 = dot(aDisp, aDisp);
      // bFromAT = the t parameter for edge a for the point b.from
      var bFromAT = dot(fromDisp, aDisp) / aDisp2;
      var bToAT = bFromAT + dot(bDisp, aDisp) / aDisp2;
      var bWasReversed = false;
      if (bFromAT > bToAT) {
	// reverse b's AT params so that it looks like it's going the same
	// direction as a, but remember we did that so that we can treat the
	// half-openness of b's endpoints correctly
	bWasReversed = true;
	var tmp = bFromAT;
	bFromAT = bToAT;
	bToAT = tmp;
      }
      if (bFromAT >= 1) { // b completely after a
	return [];
      }
      if (bToAT < 0) { // b completely before a
	return [];
      }
      // at this point, we know that b overlaps a, but we need to decide which
      // intersection points to output based on how they overlap, and whether
      // the intersection we're about to output is the start of a chain vs. in
      // the middle
      var ret = [];
      if (bWasReversed) {
	if (bFromAT < 0) { // a.from was on b (not including b.to)
	  ret.push({ point: a.from, edges: [a, b] });
	}
	if (bToAT < 1) { // b's "to" (really b.from) was on a
	  ret.push({ point: b.from, edges: [a, b] });
	}
      // else b was not reversed
	         // and is not in the middle of a chain of overlaps
      } else if (!(pointsWithinEpsilon(a.from, b.from) &&
	           collinear(a.prevFrom, b.prevFrom, a.from))) {
        if (bFromAT <= 0) { // a.from was on b (possibly at b.from)
	  ret.push({ point: a.from, edges: [a, b] });
	}
	if (bFromAT >= 0) { // b.from was on a (possibly at a.from)
	  ret.push({ point: b.from, edges: [a, b] });
	}
      }
      return ret;
    } else { // not collinear
      return [];
    }
  }
  var aT = fromCrossB / dispCross;
  if (aT < 0 || aT >= 1) { // intersection is outside of a's bounds
    return [];
  }
  var bT = cross(fromDisp, aDisp) / dispCross;
  if (bT < 0 || bT >= 1) { // intersection is outside of b's bounds
    return [];
  }
  return [{ point: addv(a.from, scale(aDisp, aT)), edges: [a, b] }];
}

/* Given an Array of edges, return an Array of intersections representing
 * points where two or more of the edges intersect. Edge intersections
 * involving overlaps instead of points are also returned, but not merged with
 * each other. See above for definitions of edges and intersections.
 */
function findEdgeIntersections(edges) {
  var edgeInts = [];
  // TODO sweep-line algorithm?
  // for now, O(n^2) brute force search:
  for (var i = 0; i < edges.length-1; i++) {
    for (var j = i+1; j < edges.length; j++) {
      var eis = edgeIntersections(edges[i], edges[j]);
      eis.forEach(ei => {
	var k = edgeInts.length;
	if ('point' in ei) {
	  // search for intersection at same point and merge
	  for (k = 0; k < edgeInts.length; k++) {
	    if (('point' in edgeInts[k]) &&
		pointsWithinEpsilon(edgeInts[k].point, ei.point)) {
	      // add new edges from ei.edges to edgeInts[k].edges
	      ei.edges.forEach(e => {
		if (!edgeInts[k].edges.includes(e)) {
		  edgeInts[k].edges.push(e);
		}
	      });
	      break;
	    }
	  }
	}
	if (k == edgeInts.length) { // new point
	  edgeInts.push(ei);
	}
      });
    }
  }
  return edgeInts;
}

/* Given an Array of rings, find the points at which their boundaries
 * intersect, as well as the corresponding indexes into the rings. Return an
 * Array of Arrays of references to those points on specific rings (one
 * sub-Array per unique point). Each such reference is an Object with the
 * following fields:
 * .ring - index of the ring
 * .edge - index of the point in the ring before the intersection point
 * .point - intersection point
 * When boundaries overlap at more than just a point, only the endpoints of the
 * overlapping segments are returned.
 */
function findRingIntersections(rings) {
  var ringInts = [];
  var edgeDict = buildEdgeDict(rings);
//  console.log("edgeDict:");
//  console.log(edgeDict);
  // for each bin with more than one segment
  for (var binKey in edgeDict) {
    var segments = edgeDict[binKey];
    if (segments.length > 1) {
      // turn segments into edges with info on where they came from
      var edges = [];
      segments.forEach(s => {
	for (var i = s.start; i < s.end; i++) {
	  var ringLen = rings[s.ring].length - 1;
	  var prevI = i - 1;
	  if (prevI < 0) { prevI += ringLen; }
	  var nextIp1 = i + 2;
	  if (nextIp1 >= ringLen) { nextIp1 -= ringLen; }
	  edges.push({
	    prevFrom: rings[s.ring][prevI],
	    from: rings[s.ring][i],
	    to: rings[s.ring][i+1],
	    nextTo: rings[s.ring][nextIp1],
	    ring: s.ring,
	    edge: i
	  });
	}
      });
//      console.log({ edges: edges });
      var edgeInts = findEdgeIntersections(edges);
      edgeInts.forEach(ei => {
	ringInts.push(ei.edges.map(e => {
	  return { ring: e.ring, edge: e.edge, point: ei.point };
	}));
      });
//      console.log({ ringInts: ringInts });
    }
  }
  return ringInts;
}

/* Is the given point in the interior of the given ring (depending on winding
 * order)? Counterclockwise rings are solid, clockwise rings are holes.
 * FIXME Assumes the point is not on the boundary?
 */
function pointIsInRing(point, ring) {
  // make an "edge" that's a ray extending infinitely east from point
  var ray = {
    // points outside the universe, so that edgeIntersections doesn't get
    // confused
    from: point, to: [181, point[1]],
    prevFrom: [-181, -91],
    nextTo: [181, 91]
  };
//  console.log({ ray: ray });
  // count how many times the ring crosses that ray counterclockwise, i.e.
  // northward (clockwise/southward crossings count negatively)
  var windingNumber = 0;
  // also compute the signed area*2 of the ring itself (shoelace formula)
  var areaTimesTwo = 0;
  for (var i = 1; i < ring.length; i++) {
    var ip1 = i + 1;
    if (ip1 >= ring.length) { ip1 -= ring.length - 1; }
    var ip2 = ip1 + 1;
    if (ip2 >= ring.length) { ip2 -= ring.length - 1; }
    var edge = { prevFrom: ring[i-1], from: ring[i], to: ring[ip1], nextTo: ring[ip2] };
//    console.log({ edge: edge });
    var ints = edgeIntersections(ray, edge);
//    console.log(JSON.stringify(ints));
    var dir = Math.sign(edge.to[1] - edge.from[1]);
    // add dir to windingNumber if the middle of the edge intersects the ray;
    // add dir/2 for each one of the endpoints that intersects the ray
    // so instead of edges being half-open by making from closed and to open,
    // we make both endpoints worth 1/2
    if (ints.length > 0) {
      // if edge.from is on the ray
      if (pointsWithinEpsilon(edge.from, ints[0].point)) {
	windingNumber += dir/2;
      } else { // intersection not at edge endpoints
	windingNumber += dir;
      }
    }
    // if edge.to is on the ray
    if (numbersWithinEpsilon(edge.to[1], ray.from[1]) &&
        edge.to[0] >= ray.from[0]) {
      windingNumber += dir/2;
    }
    areaTimesTwo += ring[i-1][0] * ring[i][1] - ring[i][0] * ring[i-1][1];
//    console.log({ windingNumber: windingNumber, areaTimesTwo: areaTimesTwo });
  }
  // area > 0 means it's a normal, counterclockwise ring, so nonzero winding
  // number means we're inside; area < 0 means it's a clockwise ring, a hole,
  // so nonzero winding number means we're inside a hole, so we're "outside"
  // the ring
  return (windingNumber == 0 ? areaTimesTwo < 0 : areaTimesTwo > 0);
}

/* Return the sign of the area of the ring: 1 if counterclockwise, -1 if
 * clockwise.
 */
function areaSign(ring) {
  // shoelace formula
  var areaTimesTwo = 0;
  for (var i = 1; i < ring.length; i++) {
    areaTimesTwo += ring[i-1][0] * ring[i][1] - ring[i][0] * ring[i-1][1];
  }
  return Math.sign(areaTimesTwo);
}

/* Is the given point in the interior of the given ring boolean? */
function pointIsInRingBoolean(point, ringBoolean) {
  if (Array.isArray(ringBoolean)) { // single ring
    return pointIsInRing(point, ringBoolean);
  } else if (ringBoolean.operator == 'and') {
    return ringBoolean.operands.every(o => pointIsInRingBoolean(point, o));
  } else { // or
    return ringBoolean.operands.some(o => pointIsInRingBoolean(point, o));
  }
}

//
// main boolean expression evaluation functions
//

function evaluateIndexBoolean(indexBoolean, values) {
  if ('number' == typeof indexBoolean) {
    return values[indexBoolean];
  } else if (indexBoolean.operator == 'and') {
    return indexBoolean.operands.every(x=>evaluateIndexBoolean(x, values));
  } else { // or
    return indexBoolean.operands.some(x=>evaluateIndexBoolean(x, values));
  }
}

/* Given an arbitrary ring boolean, convert it to a single GeoJSON MultiPolygon
 * (or, if possible, Polygon) with no unnecessary intersections between the
 * boundaries of the individual rings. That is, evaluate the ring boolean and
 * return a simple GeoJSON representation of the result.
 */
function evaluateRingBoolean(ringBoolean) {
  if (Array.isArray(ringBoolean)) { // just a ring, shortcut (FIXME is this necessary?)
    return { type: 'Polygon', coordinates: [ringBoolean] };
  }
  var rings = [];
  var indexBool = ringBooleanToIndexBoolean(ringBoolean, rings);
//  console.log({ indexBool: indexBool });
//  console.log("rings:");
//  rings.forEach(x=>console.log(x));
  var intsByPoint = findRingIntersections(rings);
//  console.log({ intsByPoint: intsByPoint });
  /* e.g., intsByPoint = [
    [ { ring: r1, edge: e1, point: p1 }, { ring: r2, edge: e2, point: p1 } ],
    [ { ring: r3, edge: e3, point: p2 }, { ring: r4, edge: e4, point: p2 } ...],
    ...
  ]
  And e.g. the edge rings[r1][e1] -> rings[r1][e1+1] contains point p1.
  */
  // reorganize intersections by ring as well, and add indexes of the
  // by-point subarrays to each intersection
  var intsByRing = rings.map(r => []);
  intsByPoint.forEach((p, pointIndex) => {
    p.forEach(i => {
      i.pointIndex = pointIndex;
      intsByRing[i.ring].push(i);
    });
  });
//  console.log({ intsByRing: intsByRing });
  // for each ring's array of intersection objects...
  intsByRing.forEach(ringInts => {
    // sort each ring's intersections by edge index, then by how far along the
    // edge the point is (distance from edge's from point)
    ringInts.sort((a,b) => {
      var edgeCmp = a.edge - b.edge;
      if (edgeCmp != 0) { return edgeCmp; }
      var from = rings[a.ring][a.edge];
      return distanceSquared(a.point, from) - distanceSquared(b.point, from);
    });
    // make note of the index of each intersection in this new order
    ringInts.forEach((ringInt, i) => {
      ringInt.intIndexInRing = i;
    });
    // splice the actual intersection points into the ring as necessary, so
    // that rings[ringInt.ring][ringInt.edge] == ringInt.point, for all
    // intersections ringInt
    if (ringInts.length > 0) {
      var oldRing = rings[ringInts[0].ring];
      var newRing = [];
      var numPointsCopied = 0;
      var numPointsAdded = 0;
      ringInts.forEach(ringInt => {
	// copy old->new up to/including the from point of the intersected edge
	for (; numPointsCopied <= ringInt.edge; numPointsCopied++) {
	  newRing.push(oldRing[numPointsCopied]);
	}
	// add the intersection point unless it's the from point
	if (!pointsWithinEpsilon(ringInt.point, oldRing[ringInt.edge])) {
	  newRing.push(ringInt.point);
	  numPointsAdded++;
	}
	// add the current offset to the edge index
	ringInt.edge += numPointsAdded;
      });
      // copy old->new after last intersection
      for (; numPointsCopied < oldRing.length; numPointsCopied++) {
	newRing.push(oldRing[numPointsCopied]);
      }
      rings[ringInts[0].ring] = newRing;
    }
  });
//  console.log("rings:");
//  rings.forEach(x=>console.log(x));
  // for each point's array of intersection objects...
  intsByPoint.forEach(pointInts => {
    // add int objs for reversed prev edges to intsByPoint, while noting the
    // direction of all intersected edges relative to the intersection point
    var newInts = [];
    pointInts.forEach(i => {
//      console.log(i);
      var ring = rings[i.ring];
      var disp = subv(ring[i.edge+1], ring[i.edge]);
      i.angle = Math.atan2(disp[1], disp[0]);
      i.outward = true;
      var prevEdge = i.edge - 1;
      if (prevEdge < 0) { prevEdge += ring.length - 1; }
      var prevDisp = subv(ring[prevEdge], ring[prevEdge+1]);
      newInts.push({
	ring: i.ring,
	edge: prevEdge,
	point: i.point,
	angle: Math.atan2(prevDisp[1], prevDisp[0]),
	outward: false
      });
    });
    pointInts.splice(pointInts.length, 0, ...newInts);
    // sort by angle
    pointInts.sort((a,b) => {
      return a.angle - b.angle;
    });
    // Now pointInts is like a pie with a cut for each edge going in or out of
    // the intersection point, and the slices are ordered counterclockwise from
    // the east. We need to decide whether each slice is interior or exterior
    // according to indexBool.
    // first, find out which rings have their boundary pass through this point
    var ringBoundaryIsHere = rings.map(r => false);
    pointInts.forEach(i => { ringBoundaryIsHere[i.ring] = true; });
//    console.log({ ringBoundaryIsHere: ringBoundaryIsHere });
    // find out whether this point is inside or outside those that don't
    var ringInteriorIsHere = rings.map(r => undefined);
    ringBoundaryIsHere.forEach((isHere, ringIndex) => {
      if (!isHere) {
	ringInteriorIsHere[ringIndex] =
	  pointIsInRing(pointInts[0].point, rings[ringIndex]);
      }
    });
//    console.log({ ringInteriorIsHere: ringInteriorIsHere });
    // go around the pie once to find out whether the first slice is inside or
    // outside the rings that *do* pass through this point, so that
    // ringInteriorIsHere no longer has any undefineds
    pointInts.forEach(i => {
      ringInteriorIsHere[i.ring] = i.outward;
//      console.log({ ringInteriorIsHere: ringInteriorIsHere, i: i });
    });
//    console.log("");
    // go around the pie again to determine whether each slice is inside or
    // outside the final product, using indexBool
    pointInts.forEach(i => {
      ringInteriorIsHere[i.ring] = i.outward;
//      console.log({ ringInteriorIsHere: ringInteriorIsHere, i: i });
      i.inside = evaluateIndexBoolean(indexBool, ringInteriorIsHere);
    });
  });
//  console.log("intsByPoint:");
//  intsByPoint.map(x=>console.log(x));
  // FIXME need to at some point remove or ignore zero-width pie slices
  // construct new rings from old ring segments bounded by intersections, using
  // .inside to decide where to go at each intersection
  var newRings = [];
  intsByPoint.forEach((startPointInts, startPointIndex) => {
//    console.log({ startPointIndex: startPointIndex });
    while (true) {
      var newRing = [];
      var pointInts = startPointInts;
      var pointIndex = startPointIndex;
      var intIndex = 0;
      // start with an inward, unused edge
      while (intIndex < pointInts.length &&
	     (pointInts[intIndex].outward || pointInts[intIndex].used)) {
	intIndex++;
      }
      // finish this point if there are none
      if (intIndex == pointInts.length) { break; }
      // iterate through intersection points on a new ring, by keeping only
      // interior on the left, and copy intermediate points into newRing
      while (true) {
//	console.log({ pointIndex: pointIndex, intIndex: intIndex });
	pointInts[intIndex].used = true;
	// cycle through intersection objects around this point clockwise from
	// the way we came in, until we get back outside
	var intCount = 0;
	var prevInside = pointInts[intIndex].inside;
	while (true) {
	  intIndex--;
	  if (intIndex < 0) { intIndex += pointInts.length; }
//	  console.log({ intIndex: intIndex, intCount: intCount });
	  if (intCount == pointInts.length) {
	    // if we go all the way around this point without finding our way
	    // out, it means this point is completely inside the final result,
	    // and thus irrelevant
	    newRing = undefined;
	    break;
	  }
	  intCount++;
	  var inside = pointInts[intIndex].inside;
//	  console.log({ inside: inside, prevInside: prevInside });
	  if (prevInside && !inside) { break; }
	  prevInside = inside; 
	}
	if (newRing === undefined) { break; }
	// go back one to get back inside
	intIndex++;
	if (intIndex >= pointInts.length) { intIndex -= pointInts.length; }
//	console.log({ intIndex: intIndex });
	// get the intersection object representing the way out of this point
	var out = pointInts[intIndex];
	if (out.used) { // we've been here before, end the loop
//	  console.log(out);
	  if (newRing.length > 0 &&
	      pointsWithinEpsilon(newRing[0], out.point)) {
	    // completed a ring, keep it
	  } else {
	    // did not complete the ring, discard it
//	    if (newRing.length > 0) {
//	      console.log('discarding newRing:');
//	      console.log(newRing);
//	    }
	    newRing = undefined;
	  }
	  break;
	}
	out.used = true;
	// get the next intersection on this ring
	// out === intsByRing[out.ring][out.intIndexInRing]
	var ringInts = intsByRing[out.ring];
	var nextIntIndexInRing = out.intIndexInRing + 1;
	if (nextIntIndexInRing >= ringInts.length) {
	  nextIntIndexInRing -= ringInts.length;
	}
	// NOTE: this is actually the outward edge from the next point, while
	// for the next iteration we will want the inward edge to the next
	// point, on this ring (see below)
	var nextInt = ringInts[nextIntIndexInRing];
//	console.log({ out: out, nextInt: nextInt });
	// copy points from the old ring into the new one between out.edge and
	// nextInt.edge
	if (out.edge < nextInt.edge) { // single stretch
	  for (var i = out.edge; i < nextInt.edge; i++) {
	    newRing.push(rings[out.ring][i]);
	  }
	} else { // wrap around, copy two stretches
	  for (var i = out.edge; i < rings[out.ring].length-1; i++) {
	    newRing.push(rings[out.ring][i]);
	  }
	  for (var i = 0; i < nextInt.edge; i++) {
	    newRing.push(rings[out.ring][i]);
	  }
	}
//	console.log({ newRing: newRing });
	// set up vars for next iteration
	pointIndex = nextInt.pointIndex;
	pointInts = intsByPoint[pointIndex];
	var inwardEdge = nextInt.edge - 1;
	if (inwardEdge < 0) { inwardEdge += rings[out.ring].length - 1; }
	intIndex =
	  pointInts.findIndex(i =>
	    (i.ring == out.ring && i.edge == inwardEdge));
      }
      if (newRing !== undefined && newRing.length >= 3) {
	// finish ring by adding the first point to the end
	newRing.push(newRing[0]);
	newRings.push(newRing);
      }
    }
  });
//  console.log({ newRings: newRings });
  // separate newRings into solids and holes based on area sign/winding
  var solids = [];
  var holes = [];
  newRings.forEach(r => {
    (areaSign(r) == 1 ? solids : holes).push(r);
  });
  // add rings that had no intersections but still managed to divide the final
  // result
  intsByRing.forEach((ringInts, ringIndex) => {
    if (ringInts.length == 0) { // no intersections
      // determine whether rings[ringIndex] divides the final result
      // first, is this a positive or negative ring (hole)?
      var posArea = (areaSign(rings[ringIndex]) == 1);
      // is the area near this ring but not surrounded by it inside each input
      // ring?
      var ringInteriorIsHere =
        rings.map((ring, index) => {
	  if (index == ringIndex) {
	    return !posArea;
	  } else {
	    return pointIsInRing(rings[ringIndex][0], ring);
	  }
	});
      var exterior = evaluateIndexBoolean(indexBool, ringInteriorIsHere);
      ringInteriorIsHere[ringIndex] = posArea; // go just inside this ring
      var interior = evaluateIndexBoolean(indexBool, ringInteriorIsHere);
      // does the presence of this ring change the status of the area
      // surrounded by it?
      if (exterior ^ interior) {
	// if so, add it to the appropriate output list
	(posArea ? solids : holes).push(rings[ringIndex]);
      }
    }
  });
//  console.log("solids:");
//  solids.forEach(x=>console.log(x));
//  console.log("holes:");
//  holes.forEach(x=>console.log(x));
  // assign each hole to the solid it's inside, construct a MultiPolygon
  var polygons = solids.map(x=>[x]);
  holes.forEach((hole, i) => {
    var polygon = polygons.find(p => pointIsInRing(hole[0], p[0]));
//    console.log({ i: i, hole: hole, polygon: polygon });
    if (polygon === undefined) {
      throw new Error("can't find solid ring containing hole #" + i + " starting with points " + JSON.stringify(hole.slice(0,3)));
    }
    polygon.push(hole);
  });
  if (polygons.length == 1) {
    return { type: 'Polygon', coordinates: polygons[0] };
  } else {
    return { type: 'MultiPolygon', coordinates: polygons };
  }
}

//
// ring boolean structure manipulation/conversion
//

/* Put all the rings at the leaves of ringBoolean into the rings Array, and
 * return a copy of ringBoolean with the rings replaced by their indexes into
 * that Array.
 */
function ringBooleanToIndexBoolean(ringBoolean, rings) {
  if (Array.isArray(ringBoolean)) {
    var i = rings.length;
    rings.push(ringBoolean);
    return i;
  } else {
    return {
      operator: ringBoolean.operator,
      operands:
        ringBoolean.operands.map(
          o => ringBooleanToIndexBoolean(o, rings))
    };
  }
}

/* Convert a GeoJSON (Multi)Polygon to a boolean expression whose atoms are
 * rings.
 */
function gjToRingBoolean(geom) {
  if (geom.type == 'Polygon') {
    // first, fix ring winding orders if necessary, and discard holes that
    // aren't inside their solids
    if (areaSign(geom.coordinates[0]) == -1) {
      geom.coordinates[0].reverse();
    }
    for (var i = 1; i < geom.coordinates.length; i++) {
      if (!pointIsInRing(geom.coordinates[i][0], geom.coordinates[0])) {
	console.log("WARNING: discarding hole not inside polygon: " + JSON.stringify(geom.coordinates[i][0]));
	geom.coordinates.splice(i, 1);
	i--;
      } else if (areaSign(geom.coordinates[i]) == 1) {
	geom.coordinates[i].reverse();
      }
    }
    if (geom.coordinates.length == 1) {
      return geom.coordinates[0];
    } else {
      // NOTE: since the exterior ring is counterclockwise, and hole rings are
      // clockwise, we can treat them as if they are all counterclockwise
      // exterior rings and just intersect their interiors
      return { operator: 'and', operands: geom.coordinates };
    }
  } else if (geom.type == 'MultiPolygon') {
    return {
      operator: 'or',
      operands:
        geom.coordinates.map(
	  c => gjToRingBoolean({ type: 'Polygon', coordinates: c }))
    };
  }
}

/* Effectively, do what you'd think { operator: 'not', operand: ringBoolean }
 * would do. But really, push the 'not' down by swapping 'and's and 'or's, and
 * reversing ring winding orders. Does not modify the original.
 */
function complementRingBoolean(ringBoolean) {
  if (Array.isArray(ringBoolean)) {
    return ringBoolean.slice().reverse();
  } else {
    return {
      operator: (ringBoolean.operator == 'or' ? 'and' : 'or'),
      operands: ringBoolean.operands.map(complementRingBoolean)
    };
  }
}

//
// exported functions
//

/* Given an Array of GeoJSON Polygon or MultiPolygon objects, return a Polygon
 * or MultiPolygon object with a possibly smaller total number of polygons,
 * made by merging polygons that touch or overlap. A point will be inside the
 * returned object iff it was inside any of the given objects. Shared
 * boundaries will also be inside. That is, the result can be seen as a closed
 * regular set.
 */
function union(geoms) {
  return evaluateRingBoolean({
    operator: 'or',
    operands: geoms.map(gjToRingBoolean)
  });
}

/* Given an Array of GeoJSON Polygon or MultiPolygon objects, return a Polygon
 * or MultiPolygon object representing the intersection of all the input
 * objects. Polgyons within a single MultiPolygon are not intersected with each
 * other. Rather, a MultiPolygon is like a nested union. A point will be inside
 * the returned object iff it was inside all of the given objects. Shared
 * boundaries with opposite interiors will not be inside. That is, the result
 * can be seen as a closed regular set.
 */
function intersection(geoms) {
  return evaluateRingBoolean({
    operator: 'and',
    operands: geoms.map(gjToRingBoolean)
  });
}

/* Return the (regularized) complement of the union of the given Array of
 * GeoJSON Polygon or MultiPolygon objects. A point will be inside the returned
 * object iff it was inside none of the given objects. Shared boundaries with
 * opposite interiors will not be inside. That is, the result can be seen as a
 * closed regular set.
 */
function complement(geoms) {
  return evaluateRingBoolean(complementRingBoolean({
    operator: 'or',
    operands: geoms.map(gjToRingBoolean)
  }));
}

/* Given an Array of at least one GeoJSON Polygon or MultiPolygon, return the
 * (regularized) difference between the first element and the union of the rest
 * of the elements. A point will be inside the returned object iff it was
 * inside the first given object and not inside any of the rest. The following
 * are equivalent:
 *   difference([first, ...rest])
 *   intersection([first, complement(rest)])
 */
function difference(geoms) {
  //return intersection([geoms[0], complement(geoms.slice(1))]);
  var operands = geoms.map(gjToRingBoolean);
  return evaluateRingBoolean({
    operator: 'and',
    operands: [operands[0], operands.slice(1).map(complementRingBoolean)]
  });
}

module.exports = {
  union: union,
  intersection: intersection,
  complement: complement,
  difference: difference,
  // private functions exported for testing purposes
  _collinear: collinear,
  _edgeToBins: edgeToBins,
  _buildEdgeDict: buildEdgeDict,
  _edgeIntersections: edgeIntersections,
  _findEdgeIntersections: findEdgeIntersections,
  _findRingIntersections: findRingIntersections,
  _pointIsInRing: pointIsInRing,
  _pointIsInRingBoolean: pointIsInRingBoolean,
  _evaluateIndexBoolean: evaluateIndexBoolean,
  _evaluateRingBoolean: evaluateRingBoolean,
  _ringBooleanToIndexBoolean: ringBooleanToIndexBoolean,
  _gjToRingBoolean: gjToRingBoolean,
  _complementRingBoolean: complementRingBoolean
};

