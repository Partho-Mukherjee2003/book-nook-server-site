import express from "express";
import { MongoClient } from "mongodb";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

//                         ***MongoDB connection***
const client = new MongoClient(
  `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@ac-2soslzi-shard-00-00.w0rm344.mongodb.net:27017,ac-2soslzi-shard-00-01.w0rm344.mongodb.net:27017,ac-2soslzi-shard-00-02.w0rm344.mongodb.net:27017/?ssl=true&replicaSet=atlas-13wds7-shard-0&authSource=admin`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
await connectToMongoDB();

app.get('/', (req,res)=>{
  res.send('Book nook server is running')
})






app.listen(port, () => {
  console.log(`Book nook server is running on port: ${port}`);
})


//http://localhost:5000
