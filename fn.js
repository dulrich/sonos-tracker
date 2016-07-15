// fn.js: standard js helper functions
// Copyright (C) 2015 - 2016  David Ulrich
//
// This code is similar to the functions appearing in node/lib/stdfn.js and
// html/js/stdfn.js but escape/query are simplified versions from my other
// projects that take db as an argument instead of relying on connection objects
// which are available to query/escape inside of mysqlpool

/* jshint latedef: nofunc */

function array(a) {
	if (!isdef(a)) return [];
	
	return isarray(a) ? a : [a];
}

function bool(b) {
	return (b === "false") ? false : Boolean(b);
}

function escape(db,p,sub) {
	sub = bool(sub);

	if (isarray(p)) {
		return (sub && "(" || "") + p.map(function(v) {
			return escape(db,v,true);
		}).join(",") + (sub && ")" || "");
	}
	
	return db.escape(p);
}

function fixed(f,n) {
	return float(f).toFixed(ifdef(n,int(n),2));
}

function float(n,b) {
	var f;
	f = parseFloat(n,b||10);
	return isFinite(f) ? f : 0;
}

function ifdef(v,a,b) {
	return isdef(v) ? a : b;
}

function int(n,b) {
	return parseInt(n,b||10) | 0; // jshint ignore:line
}

function isarray(a) {
	return a instanceof Array;
}

function isdef(v) {
	return v !== null && typeof v !== "undefined";
}

function isfn(f) {
	return typeof f === "function";
}

function isndef(v) {
	return v === null || typeof v === "undefined";
}

function isobj(o) {
	return typeof o === "object";
}

function isstring(s) {
	return typeof s === "string";
}

function log() {
	return console.log.apply(console,arguments);
}

function lowerCase(s) {
	return string(s).toLowerCase();
}

function orin(e,list) {
	return array(list).indexOf(e) !== -1;
}

function safe_div(a,b) {
	a = float(a);
	b = float(b);
	
	return b ? (a/b) : 0.0;
}

function string(s) {
	return ifdef(s,""+s,"");
}

function trace(msg) {
	log("TRACE: " + msg);
}

function upperCase(s) {
	return string(s).toUpperCase();
}

function query(db,q,cb) {
	var exited,out,query_o,rx_match;
	
	exited = false;
	
	if (!db) {
		return cb("query: missing or falsey required arg 'db'",null);
	}
	
	query_o = isobj(q)
		? q
		: {
			ignore : false,
			query  : q,
			param  : {}
		};
	
	query_o.ignore = bool(query_o.ignore);
	query_o.query = string(query_o.query);
	query_o.param = query_o.param || {};
	
	if (!isobj(query_o.param)) {
		return cb("query: invalid q.param, must be an object",null);
	}
	
	rx_match = /\?\w+\b/gi;
	
	out = query_o.query.replace(rx_match,function(match,pos,str) {
		var param_s;
		
		if (exited) return "";
		
		param_s = match.substr(1);
		
		if (!query_o.param[param_s] && !query_o.ignore) {
			exited = true;
			
			cb("query: unmatched template variable " + match[0],null);
			return "";
		}
		
		return escape(db,query_o.param[param_s],false);
	});
	
	// log("RUNNING QUERY:",query_o.query,out);
	
	db.query(out,cb);
}

function globalize(o) {
	[
		array,bool,fixed,float,int,safe_div,
		ifdef,
		isarray,isdef,isfn,isndef,isobj,isstring,
		lowerCase,string,upperCase,
		log,trace,
		escape,orin,query
	].forEach(function(fn) {
		o[fn.name] = fn;
	});
}

module.exports = globalize;
