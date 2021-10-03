const inquirer = require("inquirer");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const cliProgress = require("cli-progress");

let user = new SteamUser();
let csgo;
let initialized = false;

const itemNames = require("./item-names");

async function logIntoAccount() {
  await itemNames.init();
  console.log(">> You need to log into your account!");

  const { username, password, code } = await inquirer.prompt([
    {
      name: "username",
      message: "Username: ",
    },
    {
      name: "password",
      type: "password",
      message: "Password: ",
    },
    {
      name: "code",
      message: "Current Steam Guard code: ",
    },
  ]);

  user.on("error", (err) => {
    console.log(err);
    process.exit(0);
  });

  user.logOn({
    accountName: username,
    password,
    twoFactorCode: code,
  });
}

user.on("loggedOn", async (details, parental) => {
  if (initialized) return;
  initialized = true;
  csgo = new GlobalOffensive(user);
  initializedCSGO();
  user.gamesPlayed([730]);
});

function initializedCSGO() {
  csgo.on("connectedToGC", () => {
    console.log(">> Logged into your account!");
    mainMenu();
  });
}

function getAllContainers() {
  return csgo.inventory.filter((item) => item.def_index === 1201);
}

async function unloadItemsMenu() {
  const containers = getAllContainers();
  const { container } = await inquirer.prompt([
    {
      type: "list",
      name: "container",
      message: "Which container do you want to get Items from?",
      loop: false,
      choices: containers.map((container) => {
        return {
          value: container.id,
          name: `${container.custom_name} (${container.casket_contained_item_count})`,
        };
      }),
    },
  ]);

  const items = await getContainerItems(container);
  const formattedItems = formatInventory(items);
  const { chosenItem } = await inquirer.prompt([
    {
      type: "list",
      name: "chosenItem",
      message: "Which Item do you want retrieve?",
      loop: false,
      choices: Object.keys(formattedItems)
        .map((key) => {
          return {
            value: formattedItems[key],
            name: `${key} (${formattedItems[key].amount})`,
          };
        })
        .sort((a, b) => {
          return b.value.amount - a.value.amount;
        }),
    },
  ]);

  const amount = await chooseUnloadAmount(chosenItem);
  const casketItems = chosenItem.ids.slice(0, amount);
  await moveItems(container, casketItems, false);
  console.log(">> Everything has been unloaded out of the container!");
  mainMenu();
}

function getContainerItems(container) {
  return new Promise((resolve, reject) => {
    csgo.getCasketContents(container, (err, items) => {
      if (err) {
        //todo: handle err
        console.log("Something went wrong");
        reject();
      } else {
        resolve(items);
      }
    });
  });
}

async function loadItemsMenu() {
  const containers = getAllContainers();
  const items = getInventory();
  const { chosenItem, containerName } = await inquirer.prompt([
    {
      type: "list",
      name: "chosenItem",
      message: "Which Item do you want to Pack up?",
      loop: false,
      choices: Object.keys(items)
        .map((key) => {
          return {
            value: items[key],
            name: `${items[key].name} (${items[key].amount})`,
          };
        })
        .sort((a, b) => {
          return b.value.amount - a.value.amount;
        }),
    },
    {
      type: "list",
      name: "containerName",
      message: "Which container do you want to put the items into?",
      loop: false,
      choices: containers.map((container) => container.custom_name),
    },
  ]);

  const chosenContainer = containers.find(
    (container) => container.custom_name === containerName
  );
  const amount = await chooseLoadAmount(chosenContainer, chosenItem);
  const casketItems = chosenItem.ids.slice(0, amount);
  await moveItems(chosenContainer.id, casketItems, true);
  console.log(">> Everything has been packed into the container!");
  mainMenu();
}

async function moveItems(container, items, directionIn) {
  const progressBar = new cliProgress.SingleBar(
    {
      clearOnComplete: true,
      format: `[{bar}] {value} of {total} items ${
        directionIn ? "packed" : "unpacked"
      }`,
    },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(items.length, 0);
  for ([index, item] of items.entries()) {
    if (directionIn) {
      await addToCasket(container, item);
    } else {
      await removeFromCasket(container, item);
    }
    progressBar.update(index + 1);
  }
  progressBar.stop();
}

const casketPromises = {};
function addToCasket(container, item) {
  csgo.on("itemRemoved", (item) => {
    if (item.id in casketPromises) {
      const fn = casketPromises[item.id].resolve;
      delete casketPromises[item.id];
      fn();
    }
  });
  csgo.addToCasket(container, item);
  let p = new Promise((resolve, reject) => {
    casketPromises[item] = {
      resolve,
      reject,
    };
  });
  return p;
}

function removeFromCasket(container, item) {
  csgo.on("itemAcquired", (item) => {
    if (item.id in casketPromises) {
      const fn = casketPromises[item.id].resolve;
      delete casketPromises[item.id];
      fn();
    }
  });
  csgo.removeFromCasket(container, item);
  let p = new Promise((resolve, reject) => {
    casketPromises[item] = {
      resolve,
      reject,
    };
  });
  return p;
}

function chooseUnloadAmount(item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `>> You have ${
        1000 - csgo.inventory.length
      } free spaces in your inventory`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to unload?`,
      default: Math.min(item.amount, 1000 - csgo.inventory.length),
    });

    if (
      amount > item.amount ||
      amount > 1000 - csgo.inventory.length ||
      amount < 1
    ) {
      console.log("You can't unload that many items!");
      amount = await chooseUnloadAmount(item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function chooseLoadAmount(container, item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `>> The chosen container has ${
        1000 - container.casket_contained_item_count
      } free spaces`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to store?`,
      default: Math.min(
        item.amount,
        1000 - container.casket_contained_item_count
      ),
    });

    if (
      amount > item.amount ||
      amount > 1000 - container.casket_contained_item_count ||
      amount < 1
    ) {
      console.log("You can't store that many items!");
      amount = await chooseLoadAmount(container, item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function getInventory() {
  return formatInventory(csgo.inventory);
}

function formatInventory(inventory) {
  return inventory.reduce((inv, item) => {
    if (item.def_index === 1201) return inv;
    const name = itemNames.nameItem(item);
    if (!name) return inv;
    if (!inv[name]) {
      inv[name] = {
        name: name,
        ids: [],
        amount: 0,
      };
    }
    inv[name].ids.push(item.id);
    inv[name].amount += 1;
    return inv;
  }, {});
}

async function mainMenu() {
  let { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: "What do you want to do?",
      loop: false,
      choices: [
        { name: "Load Items into a storage container", value: "load" },
        { name: "Unload Items from a storage container", value: "unload" },
        { name: "Quit", value: "quit" },
      ],
    },
  ]);
  switch (choice) {
    case "load":
      loadItemsMenu();
      break;
    case "unload":
      unloadItemsMenu();
      break;
    case "quit":
      quit();
      break;
  }
}

function quit() {
  console.log(
    ">> Thank you for using this tool, feel free to give it a Star on Github <3"
  );
  process.exit(0);
}

logIntoAccount();
