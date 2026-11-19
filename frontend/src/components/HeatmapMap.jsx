import {
    MapContainer,
    TileLayer,
    Polygon,
    Tooltip
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const getCellColor = (count) => {
    if (count >= 5) return "#16a34a";
    if (count >= 2) return "#eab308";
    return "#ef4444";
};

const HeatmapMap = ({ cells }) => {
    const defaultCenter = [28.614, 77.21];

    const center = cells.length > 0
        ? [
            cells[0].boundary.reduce((sum, point) => sum + point.lat, 0)
                / cells[0].boundary.length,
            cells[0].boundary.reduce((sum, point) => sum + point.lng, 0)
                / cells[0].boundary.length
        ]
        : defaultCenter;

    return (
        <MapContainer
            center={center}
            zoom={15}
            scrollWheelZoom={true}
            className="heatmap-map"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {cells.map((cell) => {
                const positions = cell.boundary.map(
                    (point) => [point.lat, point.lng]
                );

                return (
                    <Polygon
                        key={cell.h3Cell}
                        positions={positions}
                        pathOptions={{
                            color: getCellColor(cell.availableDrivers),
                            fillColor: getCellColor(cell.availableDrivers),
                            fillOpacity: 0.55,
                            weight: 2
                        }}
                    >
                        <Tooltip>
                            <div>
                                <strong>Available drivers: </strong>
                                {cell.availableDrivers}
                                <br />
                                <strong>H3 cell: </strong>
                                {cell.h3Cell}
                            </div>
                        </Tooltip>
                    </Polygon>
                );
            })}
        </MapContainer>
    );
};

export default HeatmapMap;