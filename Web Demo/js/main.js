const xbr = autobahnXbr;

console.log('Running Autobahn ' + autobahn.version);
console.log('Running Autobahn-XBR ' + xbr.version);

//Private key of your persona
const PERSONA_PRIVATEKEY = "<PERSONA_PRIVATE_KEY>";
//Market maker address
const MARKET_MAKER_ADDR = "0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9";
//TEAM_ID
const TEAM_ID = "<TEAM_ID>";
//TICKET
const TICKET = "<TICKET>";
//TOPIC TO SUBSCRIBE TO
const TOPIC = "<TOPIC>";
//OPTIN RPC TOPIC
const OPTIN_RPC = "<OPT_IN_RPC>";

//Connect to Crossbarfx node
var connection = new autobahn.Connection({
  realm: "realm1",
  authmethods: ["ticket"],
  authid: TEAM_ID,
  onchallenge: onchallenge,
  transports: [
    {
        url: 'wss://continental2.crossbario.com/ws',
        type: 'websocket',
        serializers: [ new autobahn.serializer.MsgpackSerializer() ]
    }
]
});

//Only for authentication on crossbar
function onchallenge (session, method, extra) {
  if (method === "ticket") {
     return TICKET;
  } else {
     throw "don't know how to authenticate using '" + method + "'";
  }
}

connection.onopen = function(session) {
  console.log("Connected To Crossbarfx");
  const listGroup = document.getElementById("list-group");
  const buyButton = document.getElementById("buy_data_button");
  const optInButton = document.getElementById("opt_in_button");

  // the XBR token has 18 decimals
  const decimals = new xbr.BN("1000000000000000000");

  // maximum price we are willing to pay per (single) key: 100 XBR
  const max_price = new xbr.BN("100").mul(decimals);

  // instantiate a simple buyer
  var buyer = new xbr.SimpleBuyer(
    MARKET_MAKER_ADDR,
    PERSONA_PRIVATEKEY,
    max_price
  );

  // start buyer
  buyer.start(session).then(
    // success: we've got an active payment channel with remaining balance ..
    function(balance) {
      console.log('Delegate wallet balance: ' + balance.div(decimals).toString() + ' XBR');
    },
    // we don't have an active payment channel => bail out
    function(error) {
      console.log("Failed to start buyer:", error);
    }
  );

  //Handler for buy button
  buyButton.addEventListener("click", e => {
    e.preventDefault();
    session.subscribe(TOPIC, function (args, kwargs, details) {
      let [key_id, enc_ser, ciphertext] = args;
      // decrypt the XBR payload, potentially automatically buying a new data encryption key
      buyer.unwrap(key_id, enc_ser, ciphertext).then(
          function (payload) {
              console.log("Received event " + details.publication, payload);
              //Callback triggered on publish event
              if(payload) {
                const lat = payload.lat;
                const lon = payload.lng;
                const node = document.createElement("li");
                const textNode = document.createTextNode(
                  "Lat: " + lat + " Lon:" + lon
                );
                node.className = "list-group-item";
                node.appendChild(textNode);
                listGroup.appendChild(node);
              }
          },
          function (failure) {
              console.log(failure);
              location.reload(true);
          }
      )
    }, {match:'prefix'});
  });

  //Handler for opt-in
  optInButton.addEventListener("click", e => {
    e.preventDefault();
    //Implement rpc function on the backend
    session.call(OPTIN_RPC).then(
      success => {
        if (success) {
          //If subscription is successfull register to topic
          console.log("Opt-in successful");
          buyButton.removeAttribute("disabled");
          optInButton.setAttribute("disabled", true);
        }
      },
      error => {
        console.log(error);
      }
    );
  });
};

connection.open();
