var dhcpjs = require('dhcpjs');
var util = require('util');
var server = require('./server');
var client = require('./client');

var config = { serverPort: 1067 , clientPort:1066 }


require('macaddress').all(function(err,addresses){
    if ( err ) return console.log(err);
    var mac = [];
    for ( var id in addresses ){
      if ( addresses[id].mac ){
        mac.push( addresses[id].mac );
      }
    }
    var s = server.createServer(config,function(address){
      logServerMessages(s,"server");
      setupServerResponse(s);
      console.log("Server running on:"+address);
      var c = client.createClient(config);
      logClientMessages(c,"client");
      setTimeout(function(){
        startRequest( c , mac[0] );
      },500);
    });
});

function logServerMessages(server,id){
  server.on('dhcpDiscover', function(pkt) {
      console.log(id+' dhcpDiscover:', util.inspect(pkt, false, 3));
  });
  server.on('dhcpRequest', function(pkt) {
      console.log(id+' dhcpRequest:', util.inspect(pkt, false, 3));
  });
  server.on('dhcpDecline', function(pkt) {
      console.log(id+' dhcpDecline:', util.inspect(pkt, false, 3));
  });
  server.on('dhcpRelease', function(pkt) {
      console.log(id+' dhcpRelease:', util.inspect(pkt, false, 3));
  });
  server.on('listening', function(addr) {
      console.log(id+' listening on', addr);
  });
}

function setupServerResponse(server){
  var staticAddresses = {};
  var pendingAddresses = {};
  var freeAddresses = [ "192.168.5.1" , "192.168.5.2" , "192.168.5.3" , "192.168.5.4" ];
  server.on('dhcpDiscover', function(pkt) {
    var mac = pkt.chaddr.address;
    // check if this is allocated
    if ( mac in staticAddresses ){
      sendOfferResponse( pkt , staticAddresses[mac] );
    }else{
      if ( freeAddresses.length > 0 ){
        var ip = freeAddresses.pop();
        pendingAddresses[ mac ] = ip; // place in pending
        sendOfferResponse( pkt , ip );
      }else{
        // no free addresesses, ignore
      }
    }
  });
  function sendOfferResponse( origPkt , ip ){
    console.log("offering "+ip);
    var pkt = {
        xid: origPkt.xid,
        chaddr: origPkt.chaddr.address,
        yiaddr: ip,
        options: {
            dhcpMessageType: dhcpjs.Protocol.DHCPMessageType.DHCPOFFER,
        }
    }

    var offer = server.createOfferPacket(pkt);
    server.broadcastPacket(offer, {port: config.clientPort}, function() {
        console.log('dhcpOffer: sent');
    });
  }
}

function logClientMessages(client,id){
  client.on('message', function(pkt) {
      console.log(id+' message:', util.inspect(pkt, false, 3));
  });
  client.on('dhcpOffer', function(pkt) {
      console.log(id+' dhcpOffer:', util.inspect(pkt, false, 3));
  });
  client.on('dhcpAck', function(pkt) {
      console.log(id+' dhcpAck:', util.inspect(pkt, false, 3));
  });
  client.on('dhcpNak', function(pkt) {
      console.log(id+' dhcpNak:', util.inspect(pkt, false, 3));
  });
  client.on('listening', function(addr) {
      console.log(id+' listening on', addr);
  });
}

function startRequest( client , mac , hostname){
  console.log("Requesting address for "+mac+" ("+hostname+")");

  var pkt = {
      xid: 0x01,
      chaddr: mac,
      options: {
          dhcpMessageType: dhcpjs.Protocol.DHCPMessageType.DHCPDISCOVER,
          clientIdentifier: hostname||'MyMachine',
      }
  }

  var discover = client.createDiscoverPacket(pkt);
  client.broadcastPacket(discover, {port: config.serverPort}, function() {
      console.log('dhcpDiscover: sent');
  });

}
