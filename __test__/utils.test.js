'use strict';
const hasPermissions = require('../src/utils');
const sum = require('../sum');


describe('has permissions', () => {
  const expected = [
    expect.stringMatching(/not/),
  ];
 
  it('returns a message of not having permission', () => {
    expect(hasPermissions).toBeDefined();
    expect(hasPermissions).toEqual(expect.arrayContaining(expected));
  });
});

describe('sum function', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
