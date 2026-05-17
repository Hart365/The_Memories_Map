import { LayersControl, TileLayer } from 'react-leaflet'

/**
 * MapLayers component provides various base map options
 * with accessible layer switching controls
 */
export default function MapLayers() {
  return (
    <LayersControl position="topright">
      {/* OpenStreetMap - Default */}
      <LayersControl.BaseLayer checked name="Street Map">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
      </LayersControl.BaseLayer>

      {/* Satellite Imagery */}
      <LayersControl.BaseLayer name="Satellite">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          maxZoom={19}
        />
      </LayersControl.BaseLayer>

      {/* Topographic Map */}
      <LayersControl.BaseLayer name="Topographic">
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
          maxZoom={17}
        />
      </LayersControl.BaseLayer>

      {/* Watercolor (Artistic) */}
      <LayersControl.BaseLayer name="Watercolor">
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://www.stamen.com">Stamen Design</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          maxZoom={16}
        />
      </LayersControl.BaseLayer>

      {/* Dark Mode */}
      <LayersControl.BaseLayer name="Dark">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
      </LayersControl.BaseLayer>

      {/* Light (Minimal) */}
      <LayersControl.BaseLayer name="Light">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
      </LayersControl.BaseLayer>

      {/* Humanitarian (High Contrast) */}
      <LayersControl.BaseLayer name="Humanitarian (High Contrast)">
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
          maxZoom={20}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  )
}
