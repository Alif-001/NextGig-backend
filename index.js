const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;

const admin = require("firebase-admin");

//const decoded = Buffer(process.env.FB_SEERVICES_KEY,'base64').toString('utf8');

//const serviceAccount = JSON.parse(decoded)

const serviceAccount = require("./firebase-private-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// use CommonJS require instead of ESM import and use the dns module's setServers
const { setServers } = require("dns");
setServers(["1.1.1.1", "8.8.8.8"]);

// Middleware
app.use(
  cors({
    origin: "https://nextgig-e84eb.web.app",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ massage: "unauthorized access token." });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ massage: "unauthorized access token." });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ massage: "unauthorized: no auth header." });
    }
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).send({ massage: "unauthorized access token." });
    }

    const userInfo = await admin.auth().verifyIdToken(token);

    req.tokenEmail = userInfo.email;
    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error.message);
    return res.status(401).send({ massage: "unauthorized: invalid token." });
  }
};

// Mongodb

const db_username = process.env.DB_USER;
const db_password = process.env.DB_PASSWORD;

const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
const { nextTick } = require("process");
const { json } = require("stream/consumers");
const uri = `mongodb+srv://${db_username}:${db_password}@cluster0.tab6apc.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 60000, // tries 60s before failing
  connectTimeoutMS: 60000,
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    // Get the database and collection on which to run the operation
    const jobsCollection = client.db("NextGig").collection("jobs");
    const jobsApplications = client.db("NextGig").collection("applications");

    // jwt token api
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      const user = { email };
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1h",
      });

      // set token in the cookie

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 60 * 60 * 1000,
      });

      res.send({ token });
    });

    // jobs api
    app.get("/jobs", async (req, res, next) => {
      try {
        const email = req.query.email;

        const query = {};

        if (email) {
          query.hr_email = email;
        }

        const cursor = jobsCollection.find(query);

        const result = await cursor.toArray();

        res.send(result);
      } catch (err) {
        next(err);
      }
    });

    // could be done but should not be done.
    // app.get('/jobsByEmailAddress', async (req, res) => {
    //   const email = req.query.email;
    //   const query = { hr_email: email }
    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.get("/jobs/applications", async (req, res) => {
      const email = req.query.email;

      const query = { hr_email: email };

      const jobs = await jobsCollection.find(query).toArray();

      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() };
        const application_count =
          await jobsApplications.countDocuments(applicationQuery);
        job.application_count = application_count;
      }
      res.send(jobs);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const job = req.body;

      const result = await jobsCollection.insertOne(job);

      res.send(result);
    });

    // jobs applications related api

    app.get(
      "/applications",
      verifyFirebaseToken,
      verifyToken,
      async (req, res) => {
        const email = req.query.email;

        if (email !== req.tokenEmail) {
          return res.status(403).send({ message: "forbidden access." });
        }
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "forbidden access." });
        }

        const query = {
          applicant: email,
        };

        const result = await jobsApplications.find(query).toArray();

        // bad way to aggregate data
        for (application of result) {
          const jobId = application.jobId;
          const jobQuery = { _id: new ObjectId(jobId) };

          const job = await jobsCollection.findOne(jobQuery);

          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
        }

      
        

        res.send(result);
      },
    );

    app.get("/applications/job/:job_id", async (req, res) => {
      const job_id = req.params.job_id;

      const query = { jobId: job_id };
      const result = await jobsApplications.find(query).toArray();

      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;

      const status = req.body.status;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: status,
        },
      };

      const result = await jobsApplications.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;

      const result = await jobsApplications.insertOne(application);

      res.send(result);
    });

    // Routes
    app.get("/", (req, res) => {
      res.json({ status: "ok", message: "NextGig-Backend running" });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: "Not Found" });
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    });

    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);
