const { gql } = require('apollo-server');

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
  productsById(ids: [String]): [Product]
}

type Mutation {
  login(username: String, password: String): User
  createProduct(name: String, price: Int, category: String, image: String, tags: [String], image: String, headline: String, description: String, inventory: Int , instock: Boolean, featured: Boolean, rating: Int): Product
}

`;

module.exports = typeDefs
