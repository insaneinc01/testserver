//A REALLY SIMPLE server to quickly setup necessary graphql endpoints

const { ApolloServer, ApolloError } = require('apollo-server');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId
const faker = require('faker')
const bcrypt = require('bcryptjs')
const jwt = require('jwt-simple')
const secret = "somerandomsecretsincethisisonlyatestapp"
const typeDefs = require('./typeDefs')

//MongoAtlas free database - easier to use a managed service instead of running Mongo locally
const url = 'mongodb+srv://appuser:testdb101@cluster0-ndzld.mongodb.net/test?retryWrites=true';
const dbName = 'testdb';
const client = new MongoClient(url, { useNewUrlParser: true });


//native mongodb driver - quick and dirty implementation
client.connect(async (err) => {
  assert.equal(null, err);
  console.log("Connected to MongoDB on MongoAtlas");

  // await client.db(dbName).collection("products").deleteMany({}) //Clear entire database

  let count = await client.db(dbName).collection("products").countDocuments()
  console.log(count);

//populating a large set of fake-sample data so that the frontend looks good!
  if (count < 50) {
    let productsList = Array(50).fill(0).map((x, i) => {
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

//hardcode an admin user to test out "admin features" from the frontend
  const adminUser = await client.db(dbName).collection("users").findOne({username: "admin"})
  if (!adminUser) {
    await client.db(dbName).collection("users").insertOne({
      username: "admin",
      password: bcrypt.hashSync('admin101', 8), //save hash instead of text password to MongoDB
      role: ["ADMIN"]
    })
  }

});

//this is to handle constantly stringifying _id from Mongodb before passing it to graphql
const stringifyIds = x => {
  x._id = x._id.toString()
  return x
}

//quick queries and mutations
const resolvers = {
  Query: {
    products: async () => (await client.db(dbName).collection("products").find({}).toArray()).map(stringifyIds),
    categories: async () => (await client.db(dbName).collection("categories").find({}).toArray()).map(stringifyIds),
    product: async (root, {_id}) => stringifyIds(await client.db(dbName).collection("products").findOne({_id: ObjectId(_id)})),
    productsById: async (root, {ids}) => (await client.db(dbName).collection("products").find({_id: {"$in": ids.map(i => ObjectId(i)) }}).toArray()).map(stringifyIds)
  },
  Mutation: {
    login: async (root, args, context, info) => {
      const user = await client.db(dbName).collection("users").findOne({username: args.username})
      if (user) {
        if (bcrypt.compareSync(args.password, user.password)) { //check if passwords match
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
    createProduct: async (root, args, context, info) => { //only this call is checked for admin permission
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
  context: ({ req }) => { //capture user token and check if valid user
    const token = req.headers.authorization || null

    if (token) {
      const user = jwt.decode(token, secret)
      return {user}
    } else {
      return {user: null}
    }

  },
});

server.listen().then(({ url }) => {
  console.log(`Server running at ${url}`);
});
