/*
    This file must be loaded using phantomjs.
    node.js can NOT run this file.
    
    Runs the given JavaScript file and forwards console.log to stdout.
*/

var page = require('webpage').create();
var system = require('system');

if (system.args.length === 1) {
    console.error('Usage: ' + system.args[0] + ' URL');
    phantom.exit(1);
}
var address = system.args[1];

page.onConsoleMessage = function(msg) {
    console.log(msg)
}
var success = page.injectJs(address);
if (!success) {
    console.error("FAIL to load URL " + address);
    phantom.exit(1);
}

phantom.exit();
