'use strict';
//require and export from name file for ease of coding
module.exports = require('stripe')(process.env.STRIPE_SECRET);