var BufferList = require('bufferlist').BufferList;
var EventEmitter = require('events').EventEmitter;
var sys = require('sys');

exports.Binary = Binary;
function Binary(buffer) {
    if (!(this instanceof Binary)) return new Binary(buffer);
    var binary = this;
    
    this.vars = {};
    
    this.tap = function (f) {
        actions.push({
            ready : function () { return true },
            action : function () {
                f.call(binary, binary.vars);
            },
        });
        
        return this;
    };
    
    // Perform some action when v == value
    this.when = function (v, value, f) {
        return this.tap(function (vars) {
            if (this.vars[v] == value) {
                f.call(this, vars);
            }
        });
    };
    
    // Perform some action when v != value
    this.unless = function (v, value, f) {
        return this.tap(function (vars) {
            if (this.vars[v] != value) {
                f.call(this, vars);
            }
        });
    };
    
    this.end = function (value) {
        actions.push({
            ready : function () { return true },
            action : function () { actions = [] },
            type : 'end'
        });
    };
    
    this.flush = function () {
        buffer.advance(offset);
        offset = 0;
    };
    
    function decode (bytes) {
        var acc = 0;
        for (var i = 0; i < bytes.length; i++) {
            acc += Math.pow(256,i) * bytes[i];
        }
        return acc;
    }
    
    this.get = function (opts) {
        var into_t = typeof(opts.into);
        if (into_t == 'function') {
            actions.push({
                ready : function () {
                    return buffer.length - offset >= opts.bytes;
                },
                action : function () {
                    var data = buffer.join(offset, offset + opts.bytes);
                    offset += opts.bytes;
                    opts.into.call(binary,decode(data));
                },
            });
        }
        else if (into_t == 'string') {
            actions.push({
                ready : function () {
                    return buffer.length - offset >= opts.bytes;
                },
                action : function () {
                    var data = buffer.join(offset, offset + opts.bytes);
                    offset += opts.bytes;
                    binary.vars[opts.into] = decode(data);
                },
            });
        }
        else {
            throw TypeError('Unsupported into type: ' + into_t);
        };
        return this;
    };
    
    this.getWord8 = function (into) {
        return this.get({ into : into, bytes : 1 });
    };
    
    this.gets = function (opts) {
        // todo: combine actions, return buffer object for gets
        
        if (typeof(opts.length) == 'string') {
            var s = opts.length;
            opts.length = function (vars) { return vars[s] };
        }
        
        function size () {
            return opts.length(binary.vars) * opts.bytes;
        }
        
        var into_t = typeof(opts.into);
        if (into_t == 'function') {
            actions.push({
                ready : function () {
                    var s = size();
                    return s && buffer.length - offset >= s;
                },
                action : function () {
                    var s = size();
                    var data = buffer.join(offset, offset + s);
                    offset += s;
                    opts.into.call(binary,data);
                },
            });
        }
        else if (into_t == 'string') {
            actions.push({
                ready : function () {
                    var s = size();
                    return s && buffer.length - offset >= s;
                },
                action : function () {
                    var s = size();
                    var data = buffer.join(offset, offset + s);
                    offset += s;
                    binary.vars[opts.into] = data;
                },
            });
        }
        else {
            throw TypeError('Unsupported into type: ' + into_t);
        };
        return this;
    };
    
    this.getWord8s = function (into, length) {
        return this.gets({ into : into, bytes : 1, length : length });
    };
    
    this.rewind = function (n) {
        offset -= n;
        return this;
    };
    
    this.jump = function (n) {
        offset = n;
        return this;
    };
    
    var offset = 0;
    var actions = []; // actions to perform once the bytes are available
    
    buffer.addListener('push', function pusher (args) {
        if (actions.length == 0) {
            buffer.removeListener('push', pusher);
            return;
        }
        
        var action = actions[0];
        
        if (action.ready()) {
            actions.shift();
            action.action();
            pusher();
        }
    });
}
