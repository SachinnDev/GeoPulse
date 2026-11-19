
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    vus: 100,
    duration: "30s",
};

const BASE_URL = "http://localhost:3000";
const RUN_ID = Date.now();
export default function () {
    const payload = {
        driverId: `k6-${RUN_ID}-driver-${__VU}`,
        latitude: 28.6139 + (__VU * 0.0001),
        longitude: 77.2090 + (__VU * 0.0001),
        timestamp: new Date().toISOString(),
        sequenceNumber: __ITER,
        status: "available"
    };

    const response = http.post(
        `${BASE_URL}/api/drivers/location`,
        JSON.stringify(payload),
        {
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    check(response, {
        "status is 200": (r) => r.status === 200,
        "location update accepted": (r) => {
            try {
                return r.json("accepted") === true;
            } catch {
                return false;
            }
        }
    });

    sleep(1);
}
