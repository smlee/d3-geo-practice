let geojson;
let projectionTypes = [
  'AzimuthalEqualArea',
  'AzimuthalEquidistant',
  'Gnomonic',
  'Orthographic',
  'Stereographic',
  'Albers',
  'ConicConformal',
  'ConicEqualArea',
  'ConicEquidistant',
  'Equirectangular',
  'Mercator',
  'TransverseMercator'
];

let projection;
let geoGenerator = d3.geoPath()
  .projection(projection);

let graticule = d3.geoGraticule();

let circles = [
  [-135, 0], [-90, 0], [-45, 0], [0, 0], [45, 0], [90, 0], [135, 0], [180, 0],
  [0, -70], [0, -35], [0, 35], [0, 70],
  [180, -70], [180, -35], [180, 35], [180, 70],
];
let geoCircle = d3.geoCircle().radius(10).precision(1);
const antipode = ([longitude, latitude]) => [longitude + 180, -latitude];
const now = new Date;
const day = new Date(+now).setUTCHours(0, 0, 0, 0);
const t = solar.century(now);
const longitude = (day - now) / 864e5 * 360 - 180;
const sun = () => {
  return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
}
const night = d3.geoCircle().radius(90).center(antipode(sun()));

let state = {
  type: 'Equirectangular',
  scale: 120,
  translateX: 450,
  translateY: 250,
  centerLon: 0,
  centerLat: 0,
  rotateLambda: 0.1,
  rotatePhi: 0,
  rotateGamma: 0
}

projection = d3['geo' + state.type]().precision(0.1);

function initMenu() {
  d3.select('#menu')
    .selectAll('.slider.item input')
    .on('input', function (d) {
      let attr = d3.select(this).attr('name');
      state[attr] = this.value;
      d3.select(this.parentNode.parentNode).select('.value').text(this.value);
      update()
    });

  d3.select('#menu .projection-type select')
    .on('change', function (d) {
      state.type = this.options[this.selectedIndex].value;
      update()
    })
    .selectAll('option')
    .data(projectionTypes)
    .enter()
    .append('option')
    .attr('value', function (d) { return d; })
    .text(function (d) { return d; });
}

function zoom(_projection, {
  scale = 0,
  scaleExtent = [0.8, 8]
} = {}) {
  let v0, q0, r0, a0, tl;
  console.log(_projection);
  scale = _projection['_scale'] === undefined ? (_projection['_scale'] = _projection.scale()) : _projection['_scale'];

  const zoom = d3.zoom()
    .scaleExtent(scaleExtent.map(x => x * scale))
    .on("start", onZoomStart)
    .on("zoom", onZoomEnd);

  function point(event, that) {
    const t = d3.pointers(event, that);

    if (t.length !== tl) {
      tl = t.length;
      if (tl > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      onZoomStart.call(that, event);
    }

    return tl > 1
      ? [
        d3.mean(t, p => p[0]),
        d3.mean(t, p => p[1]),
        Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0])
      ]
      : t[0];
  }

  function onZoomStart(event) {
    v0 = versor.cartesian(projection.invert(point(event, this)));
    q0 = versor((r0 = projection.rotate()));
  }

  function onZoomEnd(event) {
    projection.scale(event.transform.k);
    const pt = point(event, this);
    const v1 = versor.cartesian(projection.rotate(r0).invert(pt));
    const delta = versor.delta(v0, v1);
    let q1 = versor.multiply(q0, delta);

    // For multitouch, compose with a rotation around the axis.
    if (pt[2]) {
      const d = (pt[2] - a0) / 2;
      const s = -Math.sin(d);
      const c = Math.sign(Math.cos(d));
      q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1);
    }

    projection.rotate(versor.rotation(q1));

    // In vicinity of the antipode (unstable) of q0, restart.
    if (delta[0] < 0.7) {
      onZoomStart.call(this, event);
    }
  }
}

function update() {
  // Update projection
  projection = d3['geo' + state.type]().precision(0.1)
  geoGenerator.projection(projection);

  projection
    .scale(state.scale)
    .translate([state.translateX, state.translateY])
    .center([state.centerLon, state.centerLat])
    .rotate([state.rotateLambda, state.rotatePhi, state.rotateGamma])

  // Update world map
  let u = d3.select('g.map')
    .selectAll('path')
    .data(geojson.features)

  u.enter()
    .append('path')
    .merge(u)
    .attr('d', geoGenerator)

  // Update projection center
  let projectedCenter = projection([state.centerLon, state.centerLat]);
  d3.select('.projection-center')
    .attr('cx', projectedCenter[0])
    .attr('cy', projectedCenter[1]);

  // Update graticule
  d3.select('.graticule path')
    .datum(graticule())
    .attr('d', geoGenerator);

  // Update circles
  u = d3.select('.circles')
    .selectAll('path')
    .data(circles.map(function (d) {
      geoCircle.center(d);
      return geoCircle();
    }));

  u.enter()
    .append('path')
    .merge(u)
    .attr('d', geoGenerator);

  d3.select('.night path')
    .datum(night())
    .attr('d', geoGenerator);
}


d3.json('https://gist.githubusercontent.com/d3indepth/f28e1c3a99ea6d84986f35ac8646fac7/raw/c58cede8dab4673c91a3db702d50f7447b373d98/ne_110m_land.json')
  .then(function (json) {
    geojson = json;
    // if (!projection) {
    //   projection = d3['geo' + state.type]();
    // }
    initMenu();
    update();
    d3.select('#world-map').call(zoom);
  });
