var esprima = require('esprima')

function children(node) {
    var result = [];
    for (var k in node) {
        if (!node.hasOwnProperty(k))
            continue;
        if (k[0] === '$')
            continue;
        var val = node[k];
        if (!val)
            continue;
        if (typeof val === "object" && typeof val.type === "string") {
            result.push(val);
        }
        else if (val instanceof Array) {
            for (var i=0; i<val.length; i++) {
                var elm = val[i];
                if (typeof elm === "object" && typeof elm.type === "string") {
                    result.push(elm);
                }
            }
        } 
    }
    return result;
}

function injectParentPointers(node, parent) {
    node.$parent = parent;
    var list = children(node);
    for (var i=0; i<list.length; i++) {
        injectParentPointers(list[i], node);
    }
}

function getEnclosingFunction(node) {
    while  (node.type !== 'FunctionDeclaration' && 
            node.type !== 'FunctionExpression' && 
            node.type !== 'Program') {
        node = node.$parent;
    }
    return node;
}

function replaceNode(node, string) {
    node.$replacement = string
}

function traverse(ast) {
    switch (ast.type) {
    case 'Identifier':
        break;
    case 'FunctionExpression':
    case 'FunctionDeclaration':
        break;
    }
    return ast;
}

exports.instrument = function(code) {
    var ast = esprima.parse(code)    
    injectParentPointers(ast, null)
    var newAST = traverse(ast);
}