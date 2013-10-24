var vm = require('vm')
var fs = require('fs')
var program = require('commander')
var instrument = require('./instrument')
var spawn = require('child_process').spawn
var temp = require('temp')

temp.track(); // ensure temporary files are deleted on exit

program.version('0.1')
    .option('--runtime [node|browser]', 'Runtime environment to use (default: browser)', String, 'browser')
    .option('--tmp [FILE]', 'Use the given file as temporary')
    .parse(process.argv)

var chunks = []
var files = program.args
files.forEach(function (file) {
    chunks.push(fs.readFileSync(file, 'utf8'))
})

var instrumentedCode = instrument(chunks.join('\n'))

var tempFilePath;
if (program.tmp) {
    fs.writeFileSync(program.tmp, instrumentedCode)
    tempFilePath = program.tmp;
} else {
    var tempFile = temp.openSync('jsnap')
    fs.writeSync(tempFile.fd, instrumentedCode)    
    tempFilePath = tempFile.path;
}

var subproc;

if (program.runtime === 'node') {
    subproc = spawn('node', [tempFilePath], {stdio:['ignore',1,2]})
} else if (program.runtime === 'browser') {
    subproc = spawn('phantomjs', [__dirname + '/jsnap.phantom.js', tempFilePath], {stdio:['ignore',1,2]})
} else {
    throw new Error("Invalid runtime: " + program.runtime)
}

subproc.on('error', function(e) {
    console.error(e)
})

//subproc.stdin.write(instrumentedCode, 'utf8', function() {
//    subproc.stdin.end()
//})
