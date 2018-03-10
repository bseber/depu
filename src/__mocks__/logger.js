/* eslint-disable no-unused-vars */
const logger = jest.genMockFromModule("../logger");

const isFunction = t => typeof t === "function";

Object.entries(logger)
  .filter(([_, value]) => isFunction(value))
  .forEach(([name, _]) => (logger[name] = jest.fn()));

module.exports = logger;
