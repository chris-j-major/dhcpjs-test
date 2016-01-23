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
/*      var c = client.createClient(config);
      logClientMessages(c,"client");
      setTimeout(function(){
        startRequest( c , mac[0] );
      },500);*/
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
      pendingAddresses[ mac ] = staticAddresses[ mac ]
      delete staticAddresses[ mac ];
      sendOfferResponse( pkt , pendingAddresses[mac] );
    }else{
      if ( freeAddresses.length > 0 ){
        var ip = freeAddresses.pop();
        pendingAddresses[ mac ] = ip; // place in pending
        sendOfferResponse( pkt , ip );
      }else{
        // no free addresesses, ignore
        console.log("Addresses exausted!");
      }
    }
    console.dir( pendingAddresses );
  });
  server.on('dhcpRequest', function(pkt) {
    var mac = pkt.chaddr.address;
    if ( mac in pendingAddresses ){
      staticAddresses[mac] = pendingAddresses[mac];
      delete pendingAddresses[mac];
      sendAckResponse( pkt , staticAddresses[mac] );
    }else{
      console.log("Unexpected accept from "+mac);
      console.dir( pendingAddresses );
    }
  });
  server.on('dhcpReject', function(pkt) {
    var mac = pkt.chaddr.address;
    if ( mac in pendingAddresses ){
      freeAddresses.push( pendingAddresses[mac] );
      delete pendingAddresses[mac];
    }else{
      console.log("Unexpected reject from "+mac);
    }
  });
  server.on('dhcpRelease', function(pkt) {
    var mac = pkt.chaddr.address;
    if ( mac in staticAddresses ){
      freeAddresses.push( staticAddresses[mac] );
      delete staticAddresses[mac];
    }else{
      console.log("Unexpected release from "+mac);
    }
  });
  function sendOfferResponse( origPkt , ip ){
    console.log("offering "+ip);
    var pkt = {
        xid: origPkt.xid,
        chaddr: origPkt.chaddr.address,
        yiaddr: ip,
        sname: "MyServer",
        options: {
            dhcpMessageType: dhcpjs.Protocol.DHCPMessageType.DHCPOFFER,
            ipAddressLeaseTime: 600,
            serverIdentifier: "192.168.0.11" // myIP Address
        }
    }
    if ( origPkt.giaddr ){
      pkt.giaddr = origPkt.giaddr.address;
    }
    if ( origPkt.options.clientIdentifier ){
      pkt.options.clientIdentifier = origPkt.options.clientIdentifier;
    }

    var offer = server.createOfferPacket(pkt);
    server.broadcastPacket(offer, {port: config.clientPort}, function() {
        console.log('dhcpOffer: sent');
    });
  }
  function sendAckResponse( origPkt , ip ){
    console.log("ack "+ip);
    var pkt = {
        xid: origPkt.xid,
        chaddr: origPkt.chaddr.address,
        yiaddr: ip,
        options: {
            dhcpMessageType: dhcpjs.Protocol.DHCPMessageType.DHCPOFFER
        }
    }
    if ( origPkt.options.clientIdentifier ){
      pkt.options.clientIdentifier = origPkt.options.clientIdentifier;
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
      // now we send the requst for this ip
      var mac = pkt.chaddr.address;
      var pkt = {
          xid: 0x01,
          chaddr: mac,
          options: {
              dhcpMessageType: dhcpjs.Protocol.DHCPMessageType.DHCPREQUEST,
              clientIdentifier: /*hostname||*/'MyMachine',
              requestedIpAddress: pkt.yiaddr
          }
      }

      var request = client.createRequestPacket(pkt);
      client.broadcastPacket(request, {port: config.serverPort}, function() {
          console.log('dhcpRequest: sent');
      });
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
