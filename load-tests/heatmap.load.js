
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    vus: 200,
    duration: "30s",
};

const BASE_URL = "http://localhost:3000";

export default function () {
    const response = http.get(`${BASE_URL}/api/heatmap`);

    check(response, {
        "status is 200": (r) => r.status === 200,
        "response is successful": (r) => {
            try {
                return r.json("success") === true;
            } catch {
                return false;
            }
        },
    });

    sleep(1);
}
