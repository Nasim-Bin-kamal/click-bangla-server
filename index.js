const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");

const stripe = require("stripe")(
  "sk_test_51JvoX2HPRrHHjKcv6nK6C6YyzniFyJYtwUIrqIYHFANfYKegUD4oE45rMwhWn7r0DcM9Nf0MqvxRCmIkwnPRzsde00efp5vNUW"
);
const uuid = require("uuid").v4;

const app = express();

//middleware
app.use(cors());
app.use(express.json());

//initialize firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u0u6n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//token authorization function
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers?.authorization?.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

async function run() {
  try {
    const database = client.db("clickBanglaDB");
    const productsCollection = database.collection("products");
    const featuredCollection = database.collection("featuredProducts");
    const reviewCollection = database.collection("reviews");
    const usersCollection = database.collection("users");
    const ordersCollection = database.collection("orders");

    //GET API for all products
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find({});
      const products = await cursor.toArray();
      res.json(products);
    });

    //GET API for single product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.json(product);
    });

    //GET API for top products
    app.get("/featuredProducts", async (req, res) => {
      const cursor = featuredCollection.find({});
      const products = await cursor.toArray();
      res.json(products);
    });

    //POST API for add a product
    app.post("/products", async (req, res) => {
      const newProduct = req.body;
      console.log(newProduct);
      const result = await productsCollection.insertOne(newProduct);
      res.json(result);
    });

    //UPDATE API for a product
    app.put("/products/update/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      // console.log(updatedProduct);
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: updatedProduct };
      const result = await productsCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    //DELETE API for delete a product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.json(result);
    });

    //POST API for users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    //GET API for single user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //PUT API for save user in db with google and github
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updatedDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.json(result);
    });

    //PUT API for admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const requester = req.decodedEmail;
      console.log(user);
      console.log(requester);
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const updatedDoc = {
            $set: {
              role: "admin",
            },
          };
          const result = await usersCollection.updateOne(filter, updatedDoc);
          console.log(result);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You do not have permission to make admin" });
      }
    });

    //POST API for add review
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.json(result);
    });

    //GET API for reviews
    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find({});
      const reviews = await cursor.toArray();
      res.json(reviews);
    });

    //GET API for user order
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      let orders;
      if (email) {
        const query = { email: email };
        const cursor = ordersCollection.find(query);
        orders = await cursor.toArray();
      } else {
        const cursor = ordersCollection.find({});
        orders = await cursor.toArray();
      }
      res.json(orders);
    });

    //POST API for ordered products
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.json(result);
    });

    //DELETE API for user order
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.json(result);
    });

    //UPDATE API for update status
    app.put("/orders/update/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const updatedStatus = req.body.orderStatus;

      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          orderStatus: updatedStatus,
        },
      };
      const result = await ordersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    //stripe gateway  checkout
    app.post("/checkout", async (req, res) => {
      console.log("Request:", req.body);

      let error;
      let status;
      try {
        const { product, token } = req.body;

        const customer = await stripe.customers.create({
          email: token.email,
          source: token.id,
        });

        const idempotency_key = uuid();
        const charge = await stripe.charges.create(
          {
            amount: subtotal * 100,
            currency: "BDT",
            customer: customer.id,
            receipt_email: token.email,
            description: `Purchased the ${product.name}`,
            shipping: {
              name: token.card.name,
              address: {
                line1: token.card.address_line1,
                line2: token.card.address_line2,
                city: token.card.address_city,
                country: token.card.address_country,
                postal_code: token.card.address_zip,
              },
            },
          },
          {
            idempotency_key,
          }
        );
        console.log("Charge:", { charge });
        status = "success";
      } catch (error) {
        console.error("Error:", error);
        status = "failure";
      }

      res.json({ error, status });
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello!! From CLICK BANGLA SERVER");
});

app.listen(port, () => {
  console.log("Listening from port:", port);
});
