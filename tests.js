/**
 * Test that instrumentation does not affect behaviour.
 * 
 * Every file in the testcases directory is executed with and without instrumentation.
 * The stdout strings from the two runs are then tested for consistency.
 */

var fs = require('fs')
var program = require('commander')
var instrument = require('./src/instrument')
var execFile = require('child_process').execFile; 

var testdir = 'testcases';
var outdir = 'output';
var nodeCmd = process.argv[0]

var files = fs.readdirSync(testdir).sort()

var preludeText = fs.readFileSync('src/instrument.prelude.js')

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

files.forEach(function(filename) {
    if (!endsWith(filename, '.js'))
        return;
    var file = testdir + '/' + filename
    var code = fs.readFileSync(file, 'utf8')
    var instrumentedCode = instrument(code, {silent: false, dump:false, runtime:'node'})
    fs.writeFileSync(outdir + '/' + filename, instrumentedCode)
    execFile(nodeCmd, [testdir + '/' + filename], {timeout:10000}, function(err, stdout1, stderr1) {
        if (err) {
            throw err;
        }
        stdout1 = stdout1.toString('utf8')
        stderr1 = stderr1.toString('utf8')
        execFile(nodeCmd, [outdir + '/' + filename], {timeout:10000}, function(err, stdout2, stderr2) {
            if (err)
                throw err;
            var msg = "OK";
            stdout2 = stdout2.toString('utf8')
            stderr2 = stderr2.toString('utf8')
            if (stdout1 !== stdout2) {
                msg = "FAIL!";
            }
            console.log(filename + ' ' + msg);
            fs.writeFileSync(outdir + '/' + filename + '.stdout1', stdout1)
            fs.writeFileSync(outdir + '/' + filename + '.stdout2', stdout2)
            fs.writeFileSync(outdir + '/' + filename + '.stderr1', stderr1)
            fs.writeFileSync(outdir + '/' + filename + '.stderr2', stderr2)
        })
    })
})
