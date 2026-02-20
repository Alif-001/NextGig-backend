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

console.log(db_username, db_password);

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${db_username}:${db_password}@cluster0.tab6apc.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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

    
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

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
