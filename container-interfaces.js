const EventEmitter = require("events");
const GlobalOffensive = require("globaloffensive");
const Loader = class Loader extends EventEmitter {
  static direction = {
    load: 0,
    unload: 1,
  };
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
          GlobalOffensive.ItemCustomizationNotification.CasketAdded ||
        notificationType ==
          GlobalOffensive.ItemCustomizationNotification.CasketRemoved
      ) {
        itemIds.forEach((id) => {
          if (id == this.currentContainer) {
            if (this.queue.length == 0) {
              this.loading = false;
              this.emit("finished");
              return;
            }
            this._moveItem(this.queue.shift());
            this.emit("moved", this.totalRequestedItems - this.queue.length);
            return;
          }
        });
      }
    });
  }

  //do not call from outside, would ideally be private
  _moveItem(item) {
    this.currentContainer = item.container;
    if (item.direction === Loader.direction.load) {
      this.csgo.addToCasket(item.container, item.item);
    } else {
      this.csgo.removeFromCasket(item.container, item.item);
    }
  }

  move(container, items, direction) {
    this.totalRequestedItems += items.length;
    items.forEach((item) => {
      this.queue.push({ item, container, direction });
    });
    this._moveItem(this.queue.shift());
  }
};

exports.Loader = Loader;
