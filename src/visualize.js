var fs = require('fs')

function outputCSV(dump) {
    for (var i=0; i<dump.heap.length; i++) {
        var obj = dump.heap[i]
        if (!obj)
            continue;
        obj.properties.forEach(function (prop) {
            if (prop.value && typeof prop.value === 'object') {
                console.log(i + ';' + prop.value.key)
            }
            if (prop.get && typeof prop.get === 'object') {
                console.log(i + ';' + prop.get.key)
            }
            if (prop.set && typeof prop.set === 'object') {
                console.log(i + ';' + prop.set.key)
            }
        })
    }
}

function escapeLabel(x) {
    var chunks = []
    for (var i=0; i<x.length; i++) {
        switch (x[i]) {
            case '"':
                chunks.push('\\"')
                break
            case "'":
                chunks.push("\\'")
                break
            case '\b':
                chunks.push('\\b')
                break;
            case '\t':
                chunks.push('\\t')
                break
            case '\n':
                chunks.push('\\n')
                break;
            case '\r':
                chunks.push("\\r");
                break;
            case '\f':
                chunks.push("\\f");
                break;
            case '<':
                chunks.push("\\<");
                break;
            case '>':
                chunks.push("\\>");
                break;
            case '{':
                chunks.push("\\{");
                break;
            case '}':
                chunks.push("\\}");
                break;
            default:
                chunks.push(x[i])
        }
    }
    return chunks.join('')
}

function outputDOT(dump) {
    console.log("digraph {")
    console.log("  node [shape=rectangle]")
    for (var i=0; i<dump.heap.length; i++) {
        var obj = dump.heap[i]
        if (!obj)
            continue;
        obj.properties.forEach(function (prop) {
            if (prop.value && typeof prop.value === 'object') {
                console.log(i + ' -> ' + prop.value.key + '[label="' + escapeLabel(prop.name) + '"]')
            }
            if (prop.get && typeof prop.get === 'object') {
                console.log(i + ' -> ' + prop.get.key + '[label="' + escapeLabel(prop.name) + '#get"]')
            }
            if (prop.set && typeof prop.set === 'object') {
                console.log(i + ' -> ' + prop.set.key + '[label="' + escapeLabel(prop.name) + '#set"]')
            }
        })
    }
    console.log("}")
}

function main() {
    var program = require('commander')

    program
        .usage('[-o FORMAT] FILE')
        .description('Prints a visualization of the given heap dump')
        .option('-o, --output [FORMAT]', "Output format: csv, dot (default: dot)", String, 'dot')
        .parse(process.argv)
    
    var file = program.args[0]
    if (!file) {
        program.help()
    }
    
    var text = fs.readFileSync(file, 'utf8')
    var dump = JSON.parse(text)
    
    switch (program.output) {
        case 'dot':
            outputDOT(dump)
            break;
        case 'csv':
            outputCSV(dump);
            break;
        default:
            console.error("Unknown output format:" + program.output)
    }
}

exports.outputDOT = outputDOT;
exports.outputCSV = outputCSV;
exports.main = main

if (require.main === module) {
    main();
}
