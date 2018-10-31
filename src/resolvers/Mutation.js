
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');


const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in
    if(!ctx.request.userId) {
      throw new Error('You must be logged in to do that!');
    }
    const item = await ctx.db.mutation.createItem(
      {
        data: {
          //create a relationship between item an user
          user: {
            connect: {
              id: ctx.request.userId,
            },
          },
          ...args,
        },
      },
      info
    );
    return item;
  },

  updateItem(parent, args, ctx, info) {
    // first take a copy of the updates
    const updates = { ...args };
    // remove the ID from the updates
    delete updates.id;
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. find the item
    const item = await ctx.db.query.item({ where }, `{ id title user {id}}`);
    // 2. Check if they own that item, or have the permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some
      (permission => ['ADMIN','ITEMDELET'].includes(permission));
    if(!ownsItem || !hasPermissions) {
      throw new Error("You don't have permission to do that!");
    }
    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    const password = await bcrypt.hash(args.password, 10);
    const user = await ctx.db.mutation.createUser({
      data: {
       ...args,
       password,
       permissions: { set: ['USER'] },
      }
    }, info)
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 *24 * 365
    });
    return user;
  },
  async signin(parent,{ email, password}, ctx, info) {
    const user = await ctx.db.query.user({where: { email }});
    if(!user){
      throw new Error('No such user found for email');
    }
    const valid = await bcrypt.compare(password, user.password);
      if(!valid) {
        throw new Error('Invalid Password');
      }
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly:true,
      maxAge: 1000 * 60 * 60 *24 * 365,
    });
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!'}
  },
  async requestReset(parent, args, ctx, info) {
   const user = await ctx.db.query.user({ where: { email: args.email } });
   if(!user) {
     throw new Error(`No such user found for email ${args.email}`)
   }
   const randomBytesPromisified = promisify(randomBytes);
   const resetToken = (await randomBytesPromisified(20)).toString('hex');
   const resetTokenExpiry = Date.now() + 3600000;
   const res = await ctx.db.mutation.updateUser({
     where: { email: args.email},
     data: { resetToken, resetTokenExpiry}
   });
   //Email them the reset token
   const mailRes = await transport.sendMail({
    from: 'dameon@dameon.com',
    to: user.email,
    subject: 'Your Password Reset Token',
    html: makeANiceEmail(`Your Password Reset Token is here!
    \n\n
    <a href="${process.env
      .FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`),
  });
   //return message
   return { message: 'Thanks!'};

  },
  async resetPassword(parent, args, ctx, info){
    if(args.password !== args.confirmPassword) {
      throw new Error ('Password does not match our records');
    }
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte : Date.now()-3600000,
      },
    });
    if(!user) {
      throw new Error('This token is either invalid or expired');
    }
    const password = await bcrypt.hash(args.password, 10);
    const updatedUser = await ctx.db.mutation.updateUser({
      where : { email: user.email},
      data: {
        password,
        resetToken: null,
        resetTokenExpiry : null
      },
    });
    const token = jwt.sign({ userId : updatedUser.id}, process.env.APP_SECRET);
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000* 60 * 60 * 24 * 365,
    });
    return updatedUser;
  },
  async updatePermissions(parent, args, ctx, info){
    if(!ctx.request.userId){
      throw new Error('You must be logged in to perform this action')
    };
    const currentUser = await ctx.db.query.user(
      {
        where: {id: ctx.request.userId, 
        },
      }, 
      info
    );
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']
    );
    return ctx.db.mutation.updateUser({
      data: {
        permissions: {
          set: args.permissions,
        }
      },
      where: {
        id: args.userId,
      },
    }, info);
  },
  async addToCart(parent, args, ctx, info) {
    const { userId } = ctx.request;
    if(!userId) {
      throw new Error('You must be signed in!');
    }
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId},
        item: { id: args.id}
      }      
    });
    if(existingCartItem){
      console.log('This item is already in their cart');
      return ctx.db.mutation.updateCartItem({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + 1 },
      }, info);
    }
    return ctx.db.mutation.createCartItem({
      data: {
        user: {
          connect: { id: userId }
        },
        item: {
          connect: { id: args.id }
        },
      },
    }, info );
  },
  async removeFromCart(parent, args, ctx, info){

    const cartItem = await ctx.db.query.cartItem({
      where: {
        id: args.id
      }
    }, `{id, user { id }}`)
    if(!cartItem) throw new Error('No Item Found!');
    if(cartItem.user.id !== ctx.request.userId) throw new Error('Cheating huhhh?');
   
    return ctx.db.mutation.deleteCartItem({
      where: { id: args.id },
    }, info);
  },
};

module.exports = Mutations;