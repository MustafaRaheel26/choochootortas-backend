/**
 * XML Parser Utility
 * Parses Datacap XML responses into JavaScript objects
 */

const xml2js = require('xml2js');

const parser = new xml2js.Parser({
  explicitArray: false,
  ignoreAttrs: true,
  mergeAttrs: false
});

/**
 * Parse XML string to JavaScript object
 */
async function parseXml(xmlString) {
  try {
    const result = await parser.parseStringPromise(xmlString);
    return result;
  } catch (error) {
    console.error('XML Parse error:', error.message);
    return {};
  }
}

/**
 * Extract RStream data from parsed XML
 */
function extractRStream(parsedXml) {
  if (parsedXml?.RStream) {
    return parsedXml.RStream;
  }
  if (parsedXml?.TStream?.Transaction) {
    return parsedXml.TStream.Transaction;
  }
  if (parsedXml?.TStream?.Admin) {
    return parsedXml.TStream.Admin;
  }
  return {};
}

/**
 * Flatten nested XML response to simple key-value pairs
 */
function flattenResponse(parsedXml) {
  const rstream = extractRStream(parsedXml);
  const result = {};
  
  for (const [key, value] of Object.entries(rstream)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        result[subKey] = subValue;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

module.exports = {
  parseXml,
  extractRStream,
  flattenResponse
};