const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId

const url = 'mongodb+srv://appuser:testdb101@cluster0-ndzld.mongodb.net/test?retryWrites=true';
const dbName = 'testdb';

const client = new MongoClient(url, { useNewUrlParser: true });

client.connect(async (err) => {
  assert.equal(null, err);
  console.log("Connected correctly to server");
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
  console.log(`🚀  Server ready at ${url}`);
});
