const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`Db Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();
const convertStateObjToResponseObj = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjToResponseObj = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(400);
    response.send("Invalid jwt token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid jwt token");
      } else {
        next();
      }
    });
  }
};

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get states api
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`;
  const dbResponse = await db.all(getStatesQuery);
  response.send(
    dbResponse.map((eachItem) => convertStateObjToResponseObj(eachItem))
  );
});

//get state api
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(convertStateObjToResponseObj(state));
});

//create district api
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const createDistrictQuery = `
    INSERT 
    INTO
    district(district_name,
        state_id,
        cases,
        cured,
        active,
        deaths)
    values('${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths};`;
  const dbResponse = await db.run(createDistrictQuery);
  response.send("District successfully added");
});

//get district api
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
      SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictObjToResponseObj(district));
  }
);

//delete district api
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
      DELETE FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District removed");
  }
);

//update district api
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `
    UPDATE district 
    SET district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//get stats api
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatusQuery = `
      SELECT SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
      WHERE state_id = ${stateId};`;
    const dbResponse = await db.get(getStatusQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
