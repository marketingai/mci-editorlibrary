// Razor1911's Gotchic 3 plays loudly in the background
const crypto = require('crypto');

const generateKey = inputItem => {
  if (typeof inputItem === 'object') return inputItem.toHash();

  const md5 = crypto.createHash('md5');
  md5.update(inputItem);
  const value = md5.digest('hex');
  return value;
};

module.exports = () => {
  if (!String.prototype.hasOwnProperty('toHash'))
    String.prototype.toHash = function() {
      return generateKey(this.toString());
    };

  if (!Object.prototype.hasOwnProperty('toHash'))
    Object.defineProperty(Object.prototype, 'toHash', {
      value: function() {
        // first need to sort the object
        // const sorted = recursiveSort(this);
        const sorted = this.recursiveSort();

        // then hash the fucker
        const str = JSON.stringify(sorted);
        return generateKey(str);
      }
    });

  if (!Object.prototype.hasOwnProperty('recursiveSort'))
    Object.defineProperty(Object.prototype, 'recursiveSort', {
      value: function() {
        // This was the best we could come up with, good ol' Connor and mes
        const recursiveSort = object => {
          if (object instanceof Array) return object.sort();

          if (typeof object !== 'object') return object;

          const newObject = {};
          for (const key of Object.keys(object).sort()) {
            newObject[key] = recursiveSort(object[key]);
          }
          return newObject;
        };

        return recursiveSort(this);
      }
    });
};
