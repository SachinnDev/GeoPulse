
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { cellToBoundary } from "h3-js";

import HeatmapMap from "./components/HeatmapMap";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

const applyCellUpdate = (previousData, update) => {
    const updatedCells = [...previousData.cells];

    const existingIndex = updatedCells.findIndex(
        (cell) => cell.h3Cell === update.h3Cell
    );

    if (update.availableDrivers <= 0) {
        if (existingIndex !== -1) {
            updatedCells.splice(existingIndex, 1);
        }
    } else {
        const boundary = cellToBoundary(update.h3Cell).map(
            ([lat, lng]) => ({ lat, lng })
        );

        const updatedCell = {
            h3Cell: update.h3Cell,
            availableDrivers: update.availableDrivers,
            boundary
        };

        if (existingIndex !== -1) {
            updatedCells[existingIndex] = updatedCell;
        } else {
            updatedCells.push(updatedCell);
        }
    }

    return {
        cells: updatedCells,
        totalCells: updatedCells.length,
        totalAvailableDrivers: updatedCells.reduce(
            (total, cell) => total + cell.availableDrivers,
            0
        ),
        generatedAt: update.generatedAt
    };
};

function App() {
    const [heatmap, setHeatmap] = useState({
        totalCells: 0,
        totalAvailableDrivers: 0,
        cells: [],
        generatedAt: null
    });

    const [connectionStatus, setConnectionStatus] = useState("connecting");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [demandSupply, setDemandSupply] = useState([]);

    useEffect(() => {
        let isMounted = true;
        let snapshotLoaded = false;
        let demandRefreshInterval = null;

        // Buffer socket events received before initial snapshot.
        const pendingUpdates = new Map();

        const socket = io(SOCKET_URL);

        socket.on("connect", () => {
            if (!isMounted) return;

            setConnectionStatus("connected");
            socket.emit("heatmap:subscribe");
        });

        socket.on("disconnect", () => {
            if (isMounted) {
                setConnectionStatus("disconnected");
            }
        });

        socket.on("connect_error", () => {
            if (isMounted) {
                setConnectionStatus("disconnected");
            }
        });

        socket.on("heatmap:cell:update", (update) => {
            if (!isMounted) return;

            if (!snapshotLoaded) {
                pendingUpdates.set(update.h3Cell, update);
                return;
            }

            setHeatmap((previousData) =>
                applyCellUpdate(previousData, update)
            );
        });

        // Load initial heatmap data.
        const loadInitialHeatmap = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/heatmap`
                );

                if (!response.ok) {
                    throw new Error(
                        `Heatmap API failed with status ${response.status}`
                    );
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error("Could not load heatmap data");
                }

                if (!isMounted) return;

                let snapshot = result.data;

                // Apply socket updates received during snapshot loading.
                for (const update of pendingUpdates.values()) {
                    snapshot = applyCellUpdate(snapshot, update);
                }

                pendingUpdates.clear();
                snapshotLoaded = true;

                setHeatmap(snapshot);
                setError("");

            } catch (err) {
                if (isMounted) {
                    setError(err.message);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // Load demand vs supply analysis.
        const loadDemandSupply = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/demand-supply/analysis`
                );

                if (!response.ok) {
                    throw new Error(
                        "Could not load demand analysis"
                    );
                }

                const result = await response.json();

                if (result.success && isMounted) {
                    setDemandSupply(result.data.cells);
                }

            } catch (err) {
                console.error(
                    "Demand analysis error:",
                    err.message
                );
            }
        };

        // Initial API calls.
        loadInitialHeatmap();
        loadDemandSupply();

        // Refresh demand data every 5 seconds.
        demandRefreshInterval = setInterval(
            loadDemandSupply,
            5000
        );

        // Cleanup when component unmounts.
        return () => {
            isMounted = false;

            if (demandRefreshInterval) {
                clearInterval(demandRefreshInterval);
            }

            socket.disconnect();
        };

    }, []);

    return (
        <div className="dashboard">

            <header className="topbar">
                <div>
                    <h1>GeoPulse</h1>
                    <p>Real-Time Driver Availability</p>
                </div>

                <div className={`connection ${connectionStatus}`}>
                    <span className="status-dot"></span>
                    {connectionStatus}
                </div>
            </header>

            <main className="main-content">

                <section className="intro">
                    <div>
                        <h2>Live Supply Heatmap</h2>
                        <p>
                            Monitor available drivers across geographical cells.
                        </p>
                    </div>
                </section>

                <section className="stats-grid">

                    <div className="stat-card">
                        <span>Total Available Drivers</span>
                        <strong>
                            {heatmap.totalAvailableDrivers}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Active H3 Cells</span>
                        <strong>{heatmap.totalCells}</strong>
                    </div>

                    <div className="stat-card">
                        <span>Connection</span>
                        <strong className="connection-value">
                            {connectionStatus}
                        </strong>
                    </div>

                </section>

                <section className="map-section">

                    <div className="map-heading">
                        <div>
                            <h3>Driver Availability Map</h3>
                            <p>Live H3 hexagonal grid</p>
                        </div>

                        <span className="live-label">LIVE</span>
                    </div>

                    {loading && (
                        <div className="map-message">
                            Loading heatmap data...
                        </div>
                    )}

                    {error && (
                        <div className="map-message error">
                            {error}
                        </div>
                    )}

                    <HeatmapMap cells={heatmap.cells} />

                </section>

                <section className="demand-section">

                    <div className="map-heading">
                        <div>
                            <h3>Demand vs Supply</h3>
                            <p>
                                Ride requests compared with available drivers
                            </p>
                        </div>
                    </div>

                    {demandSupply.length === 0 ? (
                        <p>No demand data available yet.</p>
                    ) : (
                        <div className="demand-grid">

                            {demandSupply.map((cell) => (
                                <div
                                    className="demand-card"
                                    key={cell.h3Cell}
                                >
                                    <strong>
                                        {cell.status
                                            .replace("-", " ")
                                            .toUpperCase()}
                                    </strong>

                                    <p>Demand: {cell.demand}</p>

                                    <p>
                                        Available drivers: {cell.supply}
                                    </p>

                                    <small>{cell.h3Cell}</small>
                                </div>
                            ))}

                        </div>
                    )}

                </section>

                <footer className="footer">
                    <span>
                        Last update:{" "}
                        {heatmap.generatedAt
                            ? new Date(
                                heatmap.generatedAt
                            ).toLocaleTimeString()
                            : "Waiting for data"}
                    </span>

                    <span>GeoPulse · H3 Resolution 9</span>
                </footer>

            </main>
        </div>
    );
}

export default App;
