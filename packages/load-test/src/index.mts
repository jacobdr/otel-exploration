import http from "k6/http";
import k6 from "k6";

export const options = {
  vus: 10,
  duration: "10s",
};

async function generateLoad() {
  http.get("http://localhost:3000");
  http.get("http://localhost:3000/slow");
  k6.sleep(1);
}

export default generateLoad;
