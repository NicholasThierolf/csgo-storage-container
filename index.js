const readlineSync = require("readline-sync");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const SteamCommunity = require("steamcommunity");
const communityUser = new SteamCommunity();

let user = new SteamUser();
let csgo, username, password, code;

function logIntoAccount() {
  console.log(">> You need to log into your account!");
  username = readlineSync.question("Username: ");
  password = readlineSync.question("Password: ", {
    hideEchoBack: true,
  });
  user.logOn({
    accountName: username,
    password,
  });
}

user.on("steamGuard", (domain, callback) => {
  if (domain == null) {
    //steamguard is in app
    console.log(
      ">> Please enter your Steam Guard code. You can find the Steam Guard code in your Steam app."
    );
  } else {
    //steamguard is in email
    console.log(
      ">> Please enter your Steam Guard code. You have received an E-mail to your address ending in " +
        domain
    );
  }
  code = readlineSync.question("Code: ");

  callback(code);
});

user.on("loggedOn", async (details, parental) => {
  csgo = new GlobalOffensive(user);
  initializedCSGO();
  user.gamesPlayed([730]);
});

function initializedCSGO() {
  csgo.on("connectedToGC", () => {
    console.log(">> Logged into your account!");
    startPacking();
  });
}

async function startPacking() {
  let inventory = csgo.inventory;
  let containers = [];
  let items = {};

  let assets = await getInventory(user.steamID);

  inventory.forEach((item) => {
    if (item.def_index == 1201) containers.push(item);
  });

  assets.forEach((item) => {
    if (items[item.classid] !== undefined) {
      items[item.classid].amount += 1;
      items[item.classid].ids.push(item.id);
    } else {
      items[item.classid] = { amount: 1, ids: [item.id] };
    }
  });

  let itemsArray = [];

  Object.keys(items).forEach((key) => {
    itemsArray.push({ classid: key });
  });

  let descriptions = await getAssetClassInfo(itemsArray);
  let itemNames = [];

  descriptions.forEach((description) => {
    Object.keys(items).forEach((key) => {
      if (key == description.classid) {
        items[key].name = description.market_hash_name;

        if (items[key].amount > 10) {
          itemNames.push(description.market_hash_name);
        }
      }
    });
  });

  let index = readlineSync.keyInSelect(
    itemNames,
    "Which Item do you want to Pack up?"
  );
  let itemName = itemNames[index];

  let classid;
  Object.keys(items).forEach((key) => {
    if (itemName == items[key].name) {
      classid = key;
    }
  });

  let containerNames = containers.map((container) => container.custom_name);

  index = readlineSync.keyInSelect(
    containerNames,
    "Which container do you want to put the items into?"
  );

  let containerName = containerNames[index];
  let chosenContainer;
  containers.forEach((container) => {
    if (container.custom_name == containerName) {
      chosenContainer = container;
    }
  });
  let amount = await chooseAmount(chosenContainer, items[classid]);

  for (let i = 0; i < amount; i++) {
    csgo.addToCasket(chosenContainer.id, items[classid].ids[i]);
  }

  console.log(
    ">> Everything has been tightly packed into the container of your choice!"
  );
  if (readlineSync.keyInYN("Do you want to store more items? ")) startPacking();
  else process.exit(1);
}

function chooseAmount(container, item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `The chosen container has ${
        1000 - container.casket_contained_item_count
      } free spaces`
    );
    let amount = readlineSync.question(
      `How many of the ${item.amount} ${item.name}s do you want to store? `
    );

    if (
      amount > item.amount ||
      amount > 1000 - container.casket_contained_item_count
    ) {
      amount = await chooseAmount(container, item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function getInventory(steamid) {
  return new Promise((resolve, reject) => {
    communityUser.getUserInventoryContents(
      steamid,
      730,
      2,
      false,
      (err, inventory) => {
        if (err) {
          reject();
          throw err;
        }

        resolve(inventory);
      }
    );
  });
}

function getAssetClassInfo(itemsArray) {
  return new Promise((resolve, reject) => {
    user.getAssetClassInfo("en", 730, itemsArray, (err, descriptions) => {
      if (err) {
        reject();
        return;
      }
      resolve(descriptions);
    });
  });
}

logIntoAccount();
