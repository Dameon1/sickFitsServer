'use strict';
const Mutations = {
  createDog(parent, args, ctx, info) {
    // create a dog!
    console.log(args);
    return args;
  }
};

module.exports = Mutations;
