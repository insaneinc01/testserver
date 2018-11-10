const { ApolloServer, gql, ApolloError } = require('apollo-server');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId
const faker = require('faker')
const bcrypt = require('bcryptjs')
const jwt = require('jwt-simple')
const secret = "somerandomsecretsincethisisonlyatestapp"

const url = 'mongodb+srv://appuser:testdb101@cluster0-ndzld.mongodb.net/test?retryWrites=true';
const dbName = 'testdb';
const client = new MongoClient(url, { useNewUrlParser: true });

// const decoded = jwt.decode("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfaWQiOiI1YmU2YmU3NzRkMWQwYzExYWUwZTg5YzciLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6WyJBRE1JTiJdfQ.tzAHnAY2K2I_yVvIOZake8afE7uVyj6bhmf2O0VOMO0", secret)
// console.log(decoded);



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

  const adminUser = await client.db(dbName).collection("users").findOne({username: "admin"})
  if (!adminUser) {
    await client.db(dbName).collection("users").insertOne({
      username: "admin",
      password: bcrypt.hashSync('admin101', 8),
      role: ["ADMIN"]
    })
  }

});

const stringifyIds = x => {
  x._id = x._id.toString()
  return x
}

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

type User {
  _id: String
  username: String
  token: String
}

type Query {
  "List of all products"
  products: [Product]
  product(_id: String): Product
}

type Mutation {
  login(username: String, password: String): User
  createProduct(name: String, price: Int, category: String): Product
}

`;

const resolvers = {
  Query: {
    products: async () => (await client.db(dbName).collection("products").find({}).toArray()).map(stringifyIds),
    product: async (root, {_id}) => stringifyIds(await client.db(dbName).collection("products").findOne({_id: ObjectId(_id)}))
  },
  Mutation: {
    login: async (root, args, context, info) => {
      const user = await client.db(dbName).collection("users").findOne({username: args.username})
      if (user) {
        if (bcrypt.compareSync(args.password, user.password)) {
          const {_id, username, role} = user
          const x = {_id, username, token: jwt.encode({_id, username, role}, secret)}
          return stringifyIds(x)
        } else {
          throw new ApolloError("Invalid Password", "Invalid_Password" )
        }
      } else {
        throw new ApolloError("User does not exist", "No_Registered_User")
      }
    },
    createProduct: async (root, args, context, info) => {
      const result = await client.db(dbName).collection("products").insertOne(args)
      return stringifyIds(result.ops[0])
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization || ''
    console.log(token)
    // const user = getUser(token);
    // return { user };
  },
});

server.listen().then(({ url }) => {
  console.log(`Server running at ${url}`);
});
