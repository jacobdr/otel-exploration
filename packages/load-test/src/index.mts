import http from "k6/http";
// import k6 from "k6";

export const options = {
  vus: 10,
  // duration: "10s",
  duration: "120s",
};

async function generateLoad() {
  http.get("http://localhost:3000");
  http.get("http://localhost:3000/slow");
}

export default generateLoad;
