const EventEmitter = require("events");
const GlobalOffensive = require("globaloffensive");

const Loader = class Loader extends EventEmitter {
  constructor(csgo) {
    super();
    this.csgo = csgo;
    this.queue = [];
    this.currentContainer;
    this.totalRequestedItems = 0;
    this.loading = false;
    csgo.on("itemCustomizationNotification", (itemIds, notificationType) => {
      if (
        notificationType ==
        GlobalOffensive.ItemCustomizationNotification.CasketAdded
      ) {
        itemIds.forEach((id) => {
          if (id == this.currentContainer) {
            if (this.queue.length == 0) {
              this.loading = false;
              this.emit("finished");
              return;
            }
            let addItem = this.queue.shift();
            this.currentContainer = addItem.container;
            this.csgo.addToCasket(addItem.container, addItem.item);
            this.emit("added", this.totalRequestedItems - this.queue.length);
            return;
          }
        });
      }
    });
  }

  load(container, items) {
    this.totalRequestedItems = items.length;
    items.forEach((item) => {
      this.queue.push({ item, container });
    });
    let addItem = this.queue.shift();
    this.currentContainer = addItem.container;
    this.csgo.addToCasket(addItem.container, addItem.item);
  }
};

exports.Loader = Loader;
