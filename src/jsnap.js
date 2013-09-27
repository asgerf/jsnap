var vm = require('vm')
var fs = require('fs')
var program = require('commander')

program.version('0.1')
    .parse(process.argv)

var files = program.args

var file = files[0]

fs.readFile(file, {encoding:'utf8'}, function(e,data) {
    var sandbox = {};
    vm.runInNewContext(data, sandbox, file);
    console.log(Object.keys(sandbox).join("\n"))
})

