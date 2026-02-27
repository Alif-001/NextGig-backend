const express = require("express");

const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;

// use CommonJS require instead of ESM import and use the dns module's setServers
const { setServers } = require("dns");
setServers(["1.1.1.1", "8.8.8.8"]);

// Middleware
app.use(cors());
app.use(express.json());

// Mongodb

const db_username = process.env.DB_USER;
const db_password = process.env.DB_PASSWORD;

const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
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

    app.get("/applications", async (req, res) => {
      const email = req.query.email;

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
    });

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
