/*
    This file must be loaded using phantomjs.
    node.js can NOT run this file.
*/

var page = require('webpage').create();
var system = require('system');

if (system.args.length === 1) {
    console.log('Usage: ' + system.args[0] + ' URL');
    phantom.exit();
}

var address = system.args[1];
var success = page.injectJs(address);
if (!success) {
    console.log("FAIL to load URL " + address);
    phantom.exit();
}

var globals = page.evaluate(function() {
    return Object.keys(window);
});
console.log(globals.join('\n'))

phantom.exit();
