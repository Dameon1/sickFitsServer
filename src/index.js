'use strict';
require('dotenv').config({ path: 'variables.env' });
const cookieParser = require('cookie-parser');
const createServer = require('./createServer');
const db = require('./db');
const jwt = require('jsonwebtoken');
const server = createServer();

//express middlware to handle cookies (JWT)
server.express.use(cookieParser());
server.express.use((req, res, next) => {
  const { token } = req.cookies;
  if(token){
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    req.userId = userId; 
  }
  next();
});
// TODO Use express middlware to populate current user

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  deets => {
    console.log(`Server is now running on port http:/localhost:${deets.port}`);
  }
);