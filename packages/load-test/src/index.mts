import http from "k6/http";
// import k6 from "k6";

export const options = {
  vus: 20,
  // duration: "10s",
  duration: "120s",
};

async function generateLoad() {
  http.get("http://localhost:3000/join-strategy");
  http.get("http://localhost:3000/query-strategy");
}

export default generateLoad;
