import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import statesTopology from 'us-atlas/states-10m.json'
import type { FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

const serviceStateCodes: Record<string, string> = {
  '05': 'AR',
  '06': 'CA',
  '12': 'FL',
  '22': 'LA',
  '39': 'OH',
  '40': 'OK',
  '47': 'TN',
  '48': 'TX',
}

const topology = statesTopology as unknown as Topology<{ states: GeometryCollection }>
const states = feature(topology, topology.objects.states) as FeatureCollection<Geometry, { name: string }>
const projection = geoAlbersUsa().fitExtent(
  [
    [24, 18],
    [951, 586],
  ],
  states,
)
const path = geoPath(projection)

export function ServiceAreaMap() {
  return (
    <div className="service-map-stage">
      <div className="map-coordinate-grid" aria-hidden="true" />
      <svg className="service-map" viewBox="0 0 975 610" role="img" aria-labelledby="service-map-title service-map-description">
        <title id="service-map-title">CMAC Container Homes service area map</title>
        <desc id="service-map-description">
          Texas, Louisiana, Florida, Tennessee, Arkansas, Ohio, Oklahoma, and California are highlighted.
        </desc>
        <defs>
          <linearGradient id="state-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff4744" />
            <stop offset="1" stopColor="#9e080d" />
          </linearGradient>
          <pattern id="state-grid" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M18 0H0V18" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
          </pattern>
          <filter id="state-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="state-shapes">
          {states.features.map((state) => {
            const id = String(state.id).padStart(2, '0')
            const isServed = id in serviceStateCodes
            const statePath = path(state) ?? undefined
            return (
              <path
                key={id}
                d={statePath}
                className={isServed ? 'state-shape state-shape-active' : 'state-shape'}
                aria-label={state.properties?.name}
              />
            )
          })}
        </g>
        <g className="state-grid-overlay" aria-hidden="true">
          {states.features.map((state) => {
            const id = String(state.id).padStart(2, '0')
            if (!(id in serviceStateCodes)) return null
            return <path key={id} d={path(state) ?? undefined} />
          })}
        </g>
        <g className="state-labels" aria-hidden="true">
          {states.features.map((state) => {
            const id = String(state.id).padStart(2, '0')
            const code = serviceStateCodes[id]
            if (!code) return null
            const [x, y] = path.centroid(state)
            return (
              <text key={id} x={x} y={y}>
                {code}
              </text>
            )
          })}
        </g>
      </svg>
      <span className="map-axis map-axis-top" aria-hidden="true">CMAC / SERVICE GRID / 08</span>
      <span className="map-axis map-axis-bottom" aria-hidden="true">TEXAS ROOTS / MULTI-STATE REACH</span>
    </div>
  )
}
