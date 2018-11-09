const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId
const faker = require('faker')

const url = 'mongodb+srv://appuser:testdb101@cluster0-ndzld.mongodb.net/test?retryWrites=true';
const dbName = 'testdb';

const client = new MongoClient(url, { useNewUrlParser: true });

client.connect(async (err) => {
  assert.equal(null, err);
  console.log("Connected to MongoDB on MongoAtlas");

  // await client.db(dbName).collection("products").deleteMany({}) //Clear entire database

  let count = await client.db(dbName).collection("products").countDocuments()
  console.log(count);

  if (count < 50) {
    let productsList = Array(50).fill(0).map((x, i) => {
      return {
        name: faker.commerce.productName(),
        price: faker.commerce.price(),
        category: faker.commerce.department(),
        tags: [faker.commerce.productAdjective(), faker.commerce.productMaterial()],
        image: `https://picsum.photos/260/200?image=${Math.floor(Math.random() * 1000)}`,
        headline: faker.lorem.sentence(),
        description: faker.lorem.paragraph()
      }
    })

    await client.db(dbName).collection("products").insertMany(productsList)
  }

});

const stringifyIds = x => {
  x._id = x._id.toString()
  return x
}


const { ApolloServer, gql } = require('apollo-server');

const typeDefs = gql`

type Product {
  _id: String
  name: String
  price: Int
  category: String
  tags: [String]
  image: String
  headline: String
  description: String

}

type Query {
  "List of all products"
  products: [Product]
  product(_id: String): Product
}

type Mutation {
  createProduct(name: String, price: Int, category: String): Product
}

`;

const resolvers = {
  Query: {
    products: async () => (await client.db(dbName).collection("products").find({}).toArray()).map(stringifyIds),
    product: async (root, {_id}) => stringifyIds(await client.db(dbName).collection("products").findOne({_id: ObjectId(_id)}))
  },
  Mutation: {
    createProduct: async (root, args, context, info) => {
      const result = await client.db(dbName).collection("products").insertOne(args)
      console.log(result.ops);
      return stringifyIds(result.ops[0])
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`Server running at ${url}`);
});
