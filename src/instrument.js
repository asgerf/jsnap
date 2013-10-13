var esprima = require('esprima')
var escodegen = require('escodegen')
var Map = require('./map.js')
var fs = require('fs')

// Returns the given AST node's immediate children as an array.
// Property names that start with $ are considered annotations, and will be ignored.
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

// Performs a bottom-up transform of the AST.
// Each node X is replaced by f(X). When f is called for some node, all the children of that node have already been replaced.
function fmap(node, f) {
    for (var k in node) {
        if (!node.hasOwnProperty(k))
            continue;
        if (k[0] === '$')
            continue;
        var val = node[k];
        if (!val)
            continue;
        if (typeof val === "object" && typeof val.type === "string") {
            node[k] = fmap(node[k], f);
            node[k].$parent = node;
        }
        else if (val instanceof Array) {
            for (var i=0; i<val.length; i++) {
                var elm = val[i];
                if (typeof elm === "object" && typeof elm.type === "string") {
                    val[i] = fmap(elm, f);
                    val[i].$parent = node;
                }
            }
        } 
    }
    return f(node);
}

// Assigns parent pointers to each node. The parent pointer is called $parent.
function injectParentPointers(node, parent) {
    node.$parent = parent;
    var list = children(node);
    for (var i=0; i<list.length; i++) {
        injectParentPointers(list[i], node);
    }
}

// Returns the function or program immediately enclosing the given node, possibly the node itself.
function getEnclosingFunction(node) {
    while  (node.type !== 'FunctionDeclaration' && 
            node.type !== 'FunctionExpression' && 
            node.type !== 'Program') {
        node = node.$parent;
    }
    return node;
}

// Returns the function, program or catch clause immediately enclosing the given node, possibly the node itself.
function getEnclosingScope(node) {
    while  (node.type !== 'FunctionDeclaration' && 
            node.type !== 'FunctionExpression' && 
            node.type !== 'CatchClause' &&
            node.type !== 'Program') {
        node = node.$parent;
    }
    return node;
}

// True if the given node is an Identifier in expression position.
function isIdentifierExpression(node) {
    if (node.type !== 'Identifier')
        return false;
    switch (node.$parent.type) {
        case 'FunctionExpression':
        case 'FunctionDeclaration':
        case 'CatchClause':
            return false;
        case 'VariableDeclarator':
            return node.$parent.id !== node;
        case 'MemberExpression':
            return node.$parent.computed || node.$parent.property !== node;
        case 'Property':
            return node.$parent.key !== node;
        case 'LabeledStatement':
            return node.$parent.label !== node;
        case 'BreakStatement':
        case 'ContinueStatement':
            return node.$parent.label !== node;
    }
    return true;
}

// Injects an the following into functions, programs, and catch clauses
// - $env: Map from variable names in scope to Identifier at declaration
// - $depth: nesting depth from top-level
function injectEnvs(node) {
    switch (node.type) {
        case 'Program':
            node.$env = new Map;
            node.$depth = 0;
            break;
        case 'FunctionExpression':
            node.$env = new Map;
            node.$depth = 1 + getEnclosingScope(node.$parent).$depth;
            if (node.id) {
                node.$env.put(node.id.name, node.id)
            }
            for (var i=0; i<node.params.length; i++) {
                node.$env.put(node.params[i].name, node.params[i])
            }
            break;
        case 'FunctionDeclaration':
            var parent = getEnclosingFunction(node.$parent); // note: use getEnclosingFunction, because fun decls are lifted outside catch clauses
            node.$env = new Map;
            node.$depth = 1 + parent.$depth;
            parent.$env.put(node.id.name, node.id)
            for (var i=0; i<node.params.length; i++) {
                node.$env.put(node.params[i].name, node.params[i])
            }
            break;
        case 'CatchClause':
            node.$env = new Map;
            node.$env.put(node.param.name, node.param)
            node.$depth = 1 + getEnclosingScope(node.$parent).$depth;
            break;
        case 'VariableDeclarator':
            var parent = getEnclosingFunction(node) // note: use getEnclosingFunction, because vars ignore catch clauses
            parent.$env.put(node.id.name, node.id)
            break;
    }
    children(node).forEach(injectEnvs)
}

// Returns the scope to which the given name resolves. Name argument is optional if the node is an Identifier.
function resolveId(node,name) {
    if (typeof name === 'undefined' && node.type === 'Identifier')
        name = node.name
    while (node.type !== 'Program') {
        if (node.$env && node.$env.has(name)) {
            return node
        }
        node = node.$parent
    }
    return node
}

// Wraps the given expression in a call to the identity function.
// This can influence the value of the this argument if x is the callee in a function call.
function wrapID(x) {
    return {
        type: 'CallExpression',
        callee: {type:'Identifier', name:'__$__id'},
        arguments: [x]
    }
}

function wrapStmt(x) {
    return {
        type: 'ExpressionStatement',
        expression: x
    }
}

function prepare(node)  {
    switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'Program':
            node.$funDeclInits = [];
            break;
    }
    children(node).forEach(prepare);
}

function ident(x) {
    return {
        type: 'Identifier',
        name: x
    }
}

// true if the given function is a getter or a setter
function isGetterSetter(node) {
    if (node.$parent.type !== 'Property')
        return false;
    if (node.$parent.kind === 'init')
        return false;
    return true;
}

// TODO: only create necessary environments (optimization)

function transform(node) {
    var replacement = node // by default, return same object (possibly mutated)
    switch (node.type) {
        case 'VariableDeclaration':
            var fun = getEnclosingFunction(node)
            var assignments = [];
            for (var i=0; i<node.declarations.length; i++) {
                var decl = node.declarations[i];
                if (!decl.init)
                    continue;
                assignments.push({
                    type:'AssignmentExpression',
                    operator:'=',
                    left: {
                        type: 'MemberExpression',
                        object: ident("__$__env" + fun.$depth),
                        property: ident(decl.id.name)
                    },
                    right: decl.init
                })
            }
            var expr = assignments.length == 1 ? assignments[0] : {type:'SequenceExpression', expressions:assignments};
            if (node.$parent.type === 'ForStatement' && node.$parent.init === node) {
                replacement = expr
            } else if (node.$parent.type === 'ForInStatement' && node.$parent.left === node) {
                replacement = { 
                    type: 'MemberExpression',
                    object: ident("__$__env" + fun.$depth),
                    property: ident(node.declarations[0].id.name)
                }
            } else {
                if (assignments.length == 0) {
                    replacement = {type:'EmptyStatement'}
                } else {
                    replacement = {type:'ExpressionStatement', expression:expr}
                }
            }
            break;
        case 'Identifier':
            if (isIdentifierExpression(node)) {
                var scope = resolveId(node)
                var depth = scope.$depth
                if (depth > 0) {
                    replacement = {
                        type:'MemberExpression',
                        object: ident('__$__env' + depth),
                        property: ident(node.name)
                    }
                    if (node.$parent.type === 'CallExpression' && node.$parent.callee === node) {
                        replacement = wrapID(replacement) // avoid changing the this argument
                    }
                }
            }
            break;
        case 'ObjectExpression':
            var scope = getEnclosingScope(node)
            replacement = {
                type: 'CallExpression',
                callee: {
                    type: 'MemberExpression',
                    object: node,
                    property: ident("__$__setobjenv")
                },
                arguments: [ident("__$__env" + scope.$depth)]
            }
            break;
        case 'FunctionExpression':
        case 'FunctionDeclaration':
            var parent = getEnclosingFunction(node.$parent)
            var head = [];
            head.push({
                type:'VariableDeclaration',
                kind:'var',
                declarations:[{
                    type:'VariableDeclarator',
                    id: {type:'Identifier', name:'__$__env' + node.$depth},
                    init: {
                        type:'ObjectExpression',
                        properties:[{
                            type:'Property',
                            kind:'init',
                            key:ident("__$__env"),
                            value:ident("__$__env" + (node.$depth-1))
                        }].concat(node.params.map(function(param) {
                            return {
                                type:'Property',
                                kind:'init',
                                key:ident(param.name),
                                value:ident(param.name)
                            }
                        }))
                    }
                }]
            })
            var block = node.body;
            block.body = head.concat(node.$funDeclInits, block.body);
            
            if (node.type === 'FunctionExpression' && !isGetterSetter(node)) {
                replacement = {
                    type:'CallExpression',
                    callee: {
                        type:'MemberExpression',
                        object:node,
                        property:{type:'Identifier', name:"__$__setenv"}
                    },
                    arguments: [{type:'Identifier', name:"__$__env" + (node.$depth - 1)}]
                }
            } else if (node.type === 'FunctionDeclaration') {
                parent.$funDeclInits.push(wrapStmt({
                    type:'AssignmentExpression',
                    operator:'=',
                    left: {
                        type: 'MemberExpression',
                        object: ident(node.id.name),
                        property: ident("__$__env")
                    },
                    right: { type:'Identifier', name:"__$__env" + (node.$depth - 1)}
                }))
                parent.$funDeclInits.push(wrapStmt({
                    type:'AssignmentExpression',
                    operator:'=',
                    left: {
                        type: 'MemberExpression',
                        object: ident("__$__env" + (node.$depth-1)),
                        property: ident(node.id.name)
                    },
                    right: ident(node.id.name)
                }))
            }
            break;
        case 'CatchClause':
            var block = node.body;
            var stmt = {
                type: 'VariableDeclaration',
                kind: 'var',
                declarations: [{
                    type: 'VariableDeclarator',
                    id: ident("__$__env" + node.$depth),
                    init: {
                        type: 'ObjectExpression',
                        properties: [{
                            type: 'Property',
                            kind: 'init',
                            key: ident("__$__env"),
                            value: ident("__$__env" + (node.$depth - 1))
                        },{
                            type: 'Property',
                            kind: 'init',
                            key: ident(node.param.name),
                            value: ident(node.param.name)
                        }]
                    }
                }]
            }
            block.body = [stmt].concat(block.body)
            break;
    }
    return replacement;
}

function clearAnnotations(node) {
    for (var k in node) {
        if (!node.hasOwnProperty(k))
            continue;
        if (k[0] === '$')
            delete node[k]
    }
    children(node).forEach(clearAnnotations);
}

var instrument = module.exports = function(code, options) {
    // setup default options
    options = options || {}
    if (!('prelude' in options))
        options.prelude = true
        
    // parse+transform AST
    var ast = esprima.parse(code)    
    injectParentPointers(ast, null)
    injectEnvs(ast)
    prepare(ast)
    var newAST = fmap(ast, transform);
    clearAnnotations(newAST)
    
    // Generate code
    var instrumentedCode = escodegen.generate(newAST);
    if (options.prelude) {
        var preludeCode = fs.readFileSync(__dirname + '/instrument.prelude.js', 'utf8')
        instrumentedCode = preludeCode + instrumentedCode
    }
    return instrumentedCode
}

// Testing entry point
if (require.main === module) {
    main();
}
function main() {
    var program = require('commander')
    program
        .option('--no-prelude')
        .parse(process.argv)
    var options = {}
    if (program.no_prelude) {
        options.prelude = false
    }
    for (var i=0; i<program.args.length; i++) {
        var code = fs.readFileSync(program.args[i], 'utf8')
        console.log(instrument(code), options)
        options.prelude = false // only print prelude first time
    }
    // print dumping code
    console.log(fs.readFileSync(__dirname + '/instrument.dump.js', 'utf8'))
}
