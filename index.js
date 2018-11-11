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


client.connect(async (err) => {
  assert.equal(null, err);
  console.log("Connected to MongoDB on MongoAtlas");

  // await client.db(dbName).collection("products").deleteMany({}) //Clear entire database

  let count = await client.db(dbName).collection("products").countDocuments()
  console.log(count);

  if (count < 10) {
    let productsList = Array(10).fill(0).map((x, i) => {
      return {
        name: faker.commerce.productName(),
        price: faker.commerce.price(),
        category: faker.commerce.department(),
        tags: [faker.commerce.productAdjective(), faker.commerce.productAdjective(), faker.commerce.productMaterial()],
        image: `https://picsum.photos/260/200?image=${Math.floor(Math.random() * 1000)}`,
        headline: faker.lorem.sentence(),
        description: faker.lorem.paragraphs(),
        inventory: Math.floor(Math.random() * 100),
        instock: faker.random.boolean(),
        featured: faker.random.boolean(),
        rating: Math.floor(Math.random() * 5) + 1
      }
    })

    const result = await client.db(dbName).collection("products").insertMany(productsList)
    const categories = result.ops.map((item) => item.category)
    const uniqueCategories = [...new Set(categories)]
    const cats = uniqueCategories.map(item => ({category: item}))

    await await client.db(dbName).collection("categories").insertMany(cats)
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
  inventory: Int
  instock: Boolean
  featured: Boolean
  rating: Int
}

type Category {
  _id: String
  category: String
}

type User {
  _id: String
  username: String
  token: String
}

type Query {
  "List of all products"
  products: [Product]
  categories: [Category]
  product(_id: String): Product
}

type Mutation {
  login(username: String, password: String): User
  createProduct(name: String, price: Int, category: String, image: String, tags: [String], image: String, headline: String, description: String, inventory: Int , instock: Boolean, featured: Boolean, rating: Int): Product
}

`;

const resolvers = {
  Query: {
    products: async () => (await client.db(dbName).collection("products").find({}).toArray()).map(stringifyIds),
    categories: async () => (await client.db(dbName).collection("categories").find({}).toArray()).map(stringifyIds),
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
        throw new ApolloError("User does not exist, please create an account", "No_Registered_User")
      }
    },
    createProduct: async (root, args, context, info) => {
      if (context.user && context.user.role.includes("ADMIN")) {
        const result = await client.db(dbName).collection("products").insertOne({...args, ...{rating: 2}})
        return stringifyIds(result.ops[0])
      } else {
        throw new ApolloError("Please login as ADMIN to create new products", "INVALID_PERMISSIONS")
      }

    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization || null

    if (token) {
      const user = jwt.decode(token.split("Bearer ")[1], secret)
      return {user}
    } else {
      return {user: null}
    }

  },
});

server.listen().then(({ url }) => {
  console.log(`Server running at ${url}`);
});
