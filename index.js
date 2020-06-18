require('./keygen')();
const axios = require('axios');
const document = (window && window.document) || new (require("jsdom"))();

function SCACommunicator (options = {}) {
  if (!options.userKey) throw new Error('Missing required userkey');
  this.options = options;
  this.init();
}

SCACommunicator.prototype = {
  handlers: {},
  on: function (type, fn) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  },
  dispatch: function (type, data) {
    if (!this.handlers || !this.handlers[type]) return;
    for (let handler of this.handlers[type]) {
      handler(data);
    }
  }
};

SCACommunicator.prototype.init = function () {
  this.initRequestAndResponseQueues();
  this.useCaseDetailsCache = this.queueCache('useCaseDetails');
  this.consolidateRequestsAndResponses();

  this.log = {info: [], warn: [], error: [], debug: []};
  this.fetchDemoData();

  this.HTMLFields = {};
  this.on('useCaseDemoFieldsSuccess', function (demoData) {
    for (let [key, useCase] of Object.entries(demoData)) {
      this.HTMLFields[key] = this.buildHTML(useCase.fields);
    }
    
    this.dispatch('HTMLFieldsReady', this.HTMLFields);
  }.bind(this));
};

SCACommunicator.prototype.fetchDemoData = function () {
  this.useCaseNames = this.options.useCaseNames || [
    'conversionImprovement',
    'keywordConsistency',
    'improvedVisibility',
    'technicalAudit'
  ];

  this.demoData = {};
  const demoEndPoint = this.options.demoEndPoint || `https://jmhz75lc24.execute-api.us-east-2.amazonaws.com/dev/demos/custom`;

  const useCasePromises = [];
  for (let useCase of this.useCaseNames) {
    useCasePromises.push(new Promise((resolve, reject) => {
      if (this.useCaseDetailsCache.exists(useCase)) {
        this.demoData[useCase] = this.useCaseDetailsCache.get(useCase);
        this.dispatch(`${useCase}FieldDataSuccess`, this.demoData[useCase]);
        resolve(this.demoData[useCase]);
      }

      // We'll run this anyways so it updates with the new use case fields
      axios(`${demoEndPoint}/${useCase}`)
      .then(({data}) => {
        this.demoData[useCase] = data;
        this.dispatch(`${useCase}FieldDataSuccess`, this.demoData[useCase]);
        this.useCaseDetailsCache.set(useCase, this.demoData[useCase]);
        return resolve(data);
      })
      .catch(error => {
        this.dispatch(`${useCase}FieldDataError`, error);
        return reject(error)
      });
    }));
  }

  return Promise.all(useCasePromises)
    .then(() => {
      this.dispatch('useCaseDemoFieldsSuccess', this.demoData);
      return data;
    })
    .catch(error => error);
};

SCACommunicator.prototype.buildHTML = function (fieldData) {
  const fields = [];
  for (let [key, {label, fieldHTML}] of Object.entries(fieldData)) {
    if (!fieldHTML) continue;

    const labelEle = document.createElement('label');
    labelEle.textContent = label;

    let inputEle;
    if (typeof fieldHTML === 'string') {
      const dom = new DOMParser().parseFromString(fieldHTML, 'text/xml');
      inputEle = dom.firstChild;
    } else {
      for (let [ele, attributes] of Object.entries(fieldHTML)) {
        inputEle = document.createElement(ele);
        for (let [name, value] of Object.entries(attributes)) {
          if (name === 'option') {
            if (value.constructor.name === 'Array') {
              for (let option of value) {
                const opt = document.createElement(name);
                opt.textContent = option.$t;
                opt.value = option.value;
                inputEle.appendChild(opt);
              }
            } else {
              const opt = document.createElement(name);
              opt.textContent = value.$t;
              opt.value = value.value;
              inputEle.appendChild(opt);
            }
          } else {
            inputEle.setAttribute(name, value);
          }
        }
      }
    }

    
    fields.push({label: labelEle, input: inputEle});
  }
  
  return fields;
};

SCACommunicator.prototype.sendJobRequest = function (packet) {
  packet = {...packet, userKey: (packet.userKey || this.options.userKey)};
  const jobKey = packet.toHash();

  if (this.jobRequestQueueHelper.exists(jobKey)) return this.jobRequestQueueHelper.get(jobKey);

  let jobRequestEndPoint;
  if (this.options.jobRequestEndPoint) {
    jobRequestEndPoint = this.options.jobRequestEndPoint + this.options.jobRequestEndPointExtras;
   } else {
     jobRequestEndPoint = `https://jmhz75lc24.execute-api.us-east-2.amazonaws.com/dev/demos/job/`;
   }

  const reqOpt = {
    userKey: packet.userKey,
    useCaseName: packet.useCaseName,
    jobData: packet.jobData
  };

  return new Promise((resolve, reject) => {
    if (!reqOpt.jobData) return reject({status: 'failed', message: 'Missing jobData property in packet.'});
    if (!reqOpt.useCaseName) return reject({status: 'failed', message: 'Missing useCaseName property in packet.'});

    axios({
      method: 'POST',
      url: jobRequestEndPoint,
      data: reqOpt
    })
    .then(({data}) => {
      dataResp = {...data, jobKey: jobKey};
      this.dispatch('jobRequestSuccessful', dataResp);
      this.jobRequestQueueHelper.set(jobKey, dataResp);
      return resolve(dataResp);
    })
    .catch(error => {
      this.dispatch('jobRequestFailed', error);
      return reject(error);
    });
  });
};

SCACommunicator.prototype.fetchJobResponse = function (jobKey) {
  if (this.jobResponseQueueHelper.exists(jobKey)) {
    this.dispatch('jobResponseSuccess', this.jobResponseQueueHelper.get(jobKey));
    return this.jobResponseQueueHelper.get(jobKey);
  }

  const {jobID, ...jobRequest} = this.jobRequestQueueHelper.get(jobKey) || {};
  if (!jobRequest || !jobID) return reject(`No request could be found matching the jobKey: ${jobKey}. Ensure you're not sending the jobID by mistake.`);

  let jobResponseEndPoint;
  if (this.options.jobResponseEndPoint) {
    jobResponseEndPoint = `${this.options.jobResponseEndPoint}/${jobID}${this.options.jobResponseEndPointExtras}`
  } else {
    jobResponseEndPoint = `https://jmhz75lc24.execute-api.us-east-2.amazonaws.com/dev/demos/job/${jobID}/full`;
  }

  return new Promise((resolve, reject) => {
    const jobCheck = setInterval(() => {
      axios(jobResponseEndPoint)
      .then(({data}) => {
        if (data.job) {
          clearInterval(jobCheck);
          const dataResp = {...data.job, jobKey}
          this.jobResponseQueueHelper.set(jobKey, dataResp);
          this.dispatch('jobResponseSuccess', dataResp);
          console.log("Resolving with data");
          return resolve(dataResp);
        }
      })
      .catch(error => {
        this.dispatch('jobResponseError', error);
        return reject(error);
      });
    }, 5000);
  });
};

SCACommunicator.prototype.queueCache = function (queueKey, data, flatten = true) {
  this[queueKey] = data || this[queueKey];
  const self = this;

  try {
    if (!this[queueKey] && localStorage.getItem(queueKey)) {
      this[queueKey] = JSON.parse(localStorage.getItem(queueKey));
    } else {
      this[queueKey] = {};
    }
  } catch (err) {
    this[queueKey] = {};
  }

  const cacheQueueMethods = {
    setQueue: function (data) {
      this[queueKey] = data;
      self.dispatch('setQueue', {queueKey, queue: this[queueKey]});
    }.bind(this),
    getQueue: function () {
      self.dispatch('getQueue', {queueKey, queue: this[queueKey]});
      return this[queueKey];
    }.bind(this),
    set: function (key, data) {
      const queue = this.getQueue();
      queue[key] = data;
      this.setQueue(queue);
      localStorage.setItem(queueKey, JSON.stringify(queue));
      self.dispatch('queueDataSet', {key, data: queue[key]});
    },
    get: function (key) {
      const queue = this.getQueue();
      self.dispatch('queueDataGet', {key, data: queue[key]});
      return queue[key];
    },
    add: function (key, data) {
      if (this.exists(key)) {
        const curData = this.get(key);
        if (curData.constructor.name === 'Array')
          data = flatten ? [...curData, ...data] : [...curData, data];
        else
          data = {...curData, ...data};
      }
      this.set(key, data);
      self.dispatch('queueKeyAdd', {key, data});
    },
    delete: function (key) {
      const queue = this.getQueue();
      delete queue[key];
      this.setQueue(queue);
      self.dispatch('queueKeyDelete', key);
    },
    exists: function (key) {
      self.dispatch('queueKeyExists', key);
      return !!this.getQueue()[key];
    }
  };

  return cacheQueueMethods;
};

SCACommunicator.prototype.consolidateRequestsAndResponses = function () {
  if (!this.jobResponseQueueHelper) throw new Error('The jobResponseQueueHelper must be instantiated before this method can be invoked.');

  const cachedJobKeys = this.getCachedJobRequestKeys();
  if (!cachedJobKeys || cachedJobKeys.length === 0) return false;

  const jobRequests = [];
  for (let key of cachedJobKeys) {
    if (!this.jobResponseQueueHelper.exists(key)) {
      jobRequests.push(new Promise(async (resolve, reject) => {
        try {
          await this.fetchJobResponse(key);
          return resolve();
        } catch (error) {
          return reject(error);
        }
      }));
    }
  }

  return Promise.all(jobRequests)
    .then(() => {
      this.dispatch('allRequestsAndResponsesConsolidated');
      return this.jobResponseQueueHelper.getQueue();
    })
    .catch(error => error);
};

SCACommunicator.prototype.getCachedJobRequestKeys = function () {
  if (!this.jobRequestQueueHelper) throw new Error('The jobRequestQueueHelper must be instantiated before this method can be invoked.');

  return Object.entries(this.jobRequestQueueHelper.getQueue())
    .map(([key]) => key);
};

SCACommunicator.prototype.clearCachedJobRequests = function () {
  this.jobRequestQueueHelper.setQueue({});
};

SCACommunicator.prototype.clearCachedJobResponses = function () {
  this.jobResponseQueueHelper.setQueue({});
};

SCACommunicator.prototype.initRequestAndResponseQueues = function () {
  this.jobRequestQueueHelper = this.queueCache('jobRequestQueue');
  this.jobResponseQueueHelper = this.queueCache('jobResponseQueue');
}

module.exports = SCACommunicator;