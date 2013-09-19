
/**
 * Standard set of utility functions that I find myself using
 *
 */

var utils = {};

/**
 * This parses JSON and automatically catches parse errors
 *
 * @param {String} text - string to parse
 */

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch(e) {
    return e;
  }
}

utils.parseJSON = parseJSON;

module.exports = exports = utils;
