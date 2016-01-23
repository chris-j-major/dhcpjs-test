var dhcp = require('dhcpjs');
var os = require('os');

var server = require('./server');
var client = require('./client');

var interfaces = os.networkInterfaces();

for(var name in interfaces){
  console.log( interfaces[name] )
  console.log( interfaces[name][0].mac );
}

var s = server.createServer(function(address){
  console.log("Server running on:"+address);
  var c = client.createClient();
  c.requrest
});
