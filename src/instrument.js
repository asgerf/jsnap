var esprima = require('esprima')
var escodegen = require('escodegen')
var Map = require('./map.js')

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
    var list = children(node)
    for (var i=0; i<list.length; i++) {
        injectEnvs(list[i])
    }
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
    var list = children(node)
    for (var i=0; i<list.length; i++) {
        prepare(list[i])
    }
}

function transform(node) {
    switch (node.type) {
        case 'VariableDeclaration':
            var assignments = [];
            for (var i=0; i<node.declarations.length; i++) {
                var decl = node.declarations[i];
                if (!decl.init)
                    continue;
                assignments.push({
                    type:'AssignmentExpression',
                    operator:'=',
                    left: decl.id,
                    right: decl.init
                })
            }
            var expr = assignments.length == 1 ? assignments[0] : {type:'SequenceExpression', expressions:assignments};
            if (node.$parent.type === 'ForStatement' && node.$parent.init === node) {
                return expr
            } else if (node.$parent.type === 'ForInStatement' && node.$parent.left === node) {
                var fun = getEnclosingFunction(node)
                return { 
                    type: 'MemberExpression',
                    object: { type:'Identifier', name:"__$__env" + fun.$depth },
                    property: { type:'Identifier', name:node.declarations[0].id }
                }
            } else {
                if (assignments.length == 0) {
                    return {type:'EmptyStatement'}
                }
                return {type:'ExpressionStatement', expression:expr}
            }
        case 'Identifier':
            if (isIdentifierExpression(node)) {
                var scope = resolveId(node)
                var depth = scope.$depth
                if (depth > 0) {
                    var newNode = {
                        type:'MemberExpression',
                        object:{ type:'Identifier', name:'__$__env' + depth },
                        property: { type:'Identifier', name:node.name }
                    }
                    if (node.$parent.type === 'CallExpression' && node.$parent.callee === node) {
                        newNode = wrapID(newNode) // avoid changing the this argument
                    }
                    return newNode
                }
            }
            break;
        case 'Program':
            
            break;
        case 'FunctionExpression':
        case 'FunctionDeclaration':
            var parent = getEnclosingFunction(node.$parent)
            node.$head = [];
            node.$depth = 1+parent.$depth
            if (!node.id) {
                node.id = {type:'Identifier', name:"__$__self"};
            }
            var envDecls = [];
            // var env0 = {}
            envDecls.push({
                type:'VariableDeclarator',
                id: {type:'Identifier', name:'__$__env0'},
                init: {
                    type:'ObjectExpression',
                    properties:[]
                }
            })
            // var env1 = self.env
            envDecls.push({
                type:'VariableDeclarator', 
                id: {type:'Identifier', name:'__$__env1'}, 
                init: {
                    type:'MemberExpression',
                    object: {type:'Identifier',name:node.id.name}, 
                    property: {type:'Identifier', name:'__$__env'}
                }
            })
            // var env(N+1) = envN.env
            for (var i=1; i<node.$depth; i++) {
                envDecls.push({
                    type:'VariableDeclarator',
                    id: {type:'Identifier', name:'__$__env' + (i+1)},
                    init: {
                        type:'MemberExpression',
                        object: {type:'Identifier', name:'__$__env' + i},
                        property: {type:'Identifier', name:'__$__env'}
                    }
                })
            }
            // var env, env0, ... envN
            node.$head.push({
                type:'VariableDeclaration',
                declarations:envDecls
            })
            // env0.env = env1
            node.$head.push(wrapStmt({
                type:'AssignmentExpression',
                operator:'=',
                left: {
                    type:'MemberExpression',
                    object: {type:'Identifier', name:'__$__env0'},
                    property: {type:'Identifier', name:'__$__env'}
                },
                right: {
                    type:'Identifier',
                    name:'__$__env1'
                }
            }))
            
            // TODO: transfer parameters into environment object
            
            var block = node.body;
            block.body = node.$head.concat(node.$funDeclInits, block.body);
            
            if (node.type === 'FunctionExpression') {
                return {
                    type:'CallExpression',
                    callee: {
                        type:'MemberExpression',
                        object:node,
                        property:{type:'Identifier', name:"__$__setenv"}
                    },
                    arguments: [{type:'Identifier', name:"__$__env0"}]
                }
            } else {
                parent.$funDeclInits.push(wrapStmt({
                    type:'AssignmentExpression',
                    operator:'=',
                    left: {
                        type: 'MemberExpression',
                        object: {type:'Identifier', name:node.id.name},
                        property: {type:'Identifier', name:"__$__env"}
                    },
                    right: { type:'Identifier', name:"__$__env0"}
                }))
            }
            break;
    }
    return node;
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

var util = require('util');

var instrument = exports.instrument = function(code) {
    var ast = esprima.parse(code)    
    injectParentPointers(ast, null)
    injectEnvs(ast)
    prepare(ast)
    var newAST = fmap(ast, transform);
    clearAnnotations(newAST)
//    return JSON.stringify(newAST)
//    return util.inspect(newAST, {depth:null});
//    return JSON.stringify(newAST);
    return escodegen.generate(newAST);
}

// Testing entry point
var fs = require('fs')
var code = fs.readFileSync(process.argv[2], 'utf8')
console.log(instrument(code))
