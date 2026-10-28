// Validates infrastructure against handwritten correct/incorrect programs.
// This is not an Ornith/Cortex benchmark campaign and performs no inference.
import assert from 'node:assert/strict';
import { fixtures } from './solar-bench/registry.mjs';
import { validateFixture,inspectReport } from './solar-bench/validators.mjs';
import { SOLAR_ROOT } from './solar-bench/webkit.mjs';
const signal=new AbortController().signal;
const solutions={
 feature:{'src/value.cjs':'exports.clamp=(value,min,max)=>Math.max(min,Math.min(max,value));'},
 'js-group-by':{'src/value.cjs':"exports.groupBy=(items,key)=>items.reduce((out,item)=>{(out[item[key]]??=[]).push(item);return out;},{});"},
 'js-stable-sort':{'src/value.cjs':'exports.sortByScore=items=>[...items].sort((a,b)=>a.score-b.score);'},
 refactor:{'src/value.cjs':'exports.sumPositive=xs=>xs.filter(x=>x>0).reduce((a,b)=>a+b,0);'},
 'refactor-multifile':{'src/format.cjs':'exports.formatName=(first,last)=>`${first} ${last}`.trim();','src/index.cjs':"exports.formatName=require('./format.cjs').formatName;"},
 'refactor-cart':{'src/math.cjs':'exports.total=items=>items.reduce((n,x)=>n+x.price*x.quantity,0);','src/cart.cjs':"exports.total=require('./math.cjs').total;"},
 'refactor-normalize':{'src/value.cjs':"exports.normalize=xs=>xs.filter(x=>typeof x==='string').map(x=>x.trim().toLowerCase()).filter(Boolean);"},
 'refactor-validation':{'src/email.cjs':"exports.isValidEmail=x=>typeof x==='string'&&/^[^@]+@[^@]+$/.test(x);",'src/users.cjs':"const {isValidEmail}=require('./email.cjs');exports.valid=xs=>xs.filter(isValidEmail);"},
};
for(const [id,files] of Object.entries(solutions)){
 const fixture=fixtures.find(f=>f.id===id);const changes=Object.entries(files).map(([path,after])=>({path,after,before:fixture.files[path]}));
 const checks=await validateFixture(fixture,changes,{signal,root:SOLAR_ROOT});assert(checks.every(c=>c.status==='passed'),id+JSON.stringify(checks));
}
const swift=fixtures.find(f=>f.id==='swift-debug');
for(const [value,expected] of [[2,'passed'],[3,'failed']]){
 const checks=await validateFixture(swift,[{path:'Value.swift',before:swift.files['Value.swift'],after:`func double(_ x: Int) -> Int { x * ${value} }`}],{signal,root:SOLAR_ROOT});
 assert.equal(checks.find(c=>c.type==='build').status,'passed');assert.equal(checks.find(c=>c.type==='tests').status,expected);
}
const wrong=await validateFixture(fixtures.find(f=>f.id==='feature'),[{path:'src/value.cjs',after:'exports.clamp=()=>0;'}],{signal});assert(wrong.some(c=>c.status==='failed'));
const still={supported:true,errors:[],frames:[{timestamp:0,elements:[{selector:'#a',opacity:1,transform:'none',filter:'none',x:0,y:0}],overflow:0},{timestamp:1000,elements:[{selector:'#a',opacity:1,transform:'none',filter:'none',x:0,y:0}],overflow:0}]};
assert.equal(inspectReport(still,{temporal:true}).find(c=>c.type==='temporal').status,'failed');
console.log('solar-bench-technical: 25 definitions, 8 independent JS validators, actual Swift build/assertions PASS and FAIL, static animation rejection — ok');
