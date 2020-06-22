require('./keygen')();
const axios = require('axios');
window = (typeof window !== 'undefined' && window) || (new (require('jsdom')).JSDOM('<!DOCTYPE html>')).window;
document = window.document;
localStorage = (typeof localStorage !== 'undefined') ? localStorage : (new (require('node-localstorage')).LocalStorage('./nodeLSCache'));

function SCACommunicator (options = {}) {
  if (!options.userKey) throw new Error('Missing required argument userkey');
  if (!options.apiEndpoint) throw new Error('Missing required argument apiEndpoint')
  
  this.options = options;
  if (this.options.loggingEnabled) this.logger = this.defaultLogger(this.options.loggingLevel || 'info');
  if (this.options.DEBUG) this.logger = this.defaultLogger('debug');

  return this;
}

SCACommunicator.prototype = {
  handlers: {},
  on: function (type, fn) {
    if (this.options.DEBUG && this.options.onLogs) this.logger.debug(`Listening to ${type}`);
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  },
  dispatch: function (type, data) {
    if (this.options.DEBUG && this.options.dispatchLogs) this.logger.debug(`Dispatching ${type}`);
    if (!this.handlers || !this.handlers[type]) return;
    for (let handler of this.handlers[type]) {
      handler(data);
    }
  }
};

SCACommunicator.prototype.init = function () {
  return new Promise (async (resolve, reject) => {
    try {
      this.dispatch.debug = this.debugDispatch.bind(this);
      this.dispatch.info = this.infoDispatch.bind(this);
      this.dispatch.success = this.successDispatch.bind(this);
      this.dispatch.failed = this.failedDispatch.bind(this);

      this.initRequestAndResponseQueues();
      this.useCaseDetailsCache = this.initQueueCache('useCaseDetails');
      await this.fetchUseCaseData();
      await this.consolidateRequestsAndResponses();

      this.dispatch.success('init', 'SCACommunicator was initialized successfully', this);
      return resolve(this);
    } catch (error) {
      this.dispatch.failed('init', 'SCACommunicator could not be initialized', 'initFailed', error);
      return reject(error);
    }
  });
};

SCACommunicator.prototype.fetchUseCaseData = function () {
  this.dispatch.info('fetchUseCaseData', )
  this.useCaseNames = this.options.useCaseNames || [
    'conversionImprovement',
    'keywordConsistency',
    'improvedVisibility',
    'technicalAudit'
  ];

  const useCaseDetailsEndpoint = this.options.useCaseDetailsEndpoint || `${this.options.apiEndpoint}/demos/custom`;

  const useCasePromises = [];
  for (let useCase of this.useCaseNames) {
    useCasePromises.push(new Promise((resolve, reject) => {
      if (this.useCaseDetailsCache.exists(useCase)) {
        this.dispatch.success(`fetchUseCaseData.${useCase}.cached`, `Successfully fetched ${useCase} use case data`, this.useCaseDetailsCache.get(useCase));
        resolve(this.useCaseDetailsCache.get(useCase));
      }

      // We'll run this anyways so it updates with the new use case fields
      axios(`${useCaseDetailsEndpoint}/${useCase}`)
      .then(({data}) => {
        this.useCaseDetailsCache.set(useCase, data);
        this.buildHTML(this.useCaseDetailsCache.get(useCase));
        this.dispatch.success(`fetchUseCaseData.${useCase}`, `Successfully fetched ${useCase} use case data`, this.useCaseDetailsCache.get(useCase));
        return resolve(this.useCaseDetailsCache.get(useCase));
      })
      .catch(error => {
        this.dispatch.failed(`fetchUseCaseData.${useCase}`, `Fetching ${useCase} use case failed`, `$useCaseDataFetchFailed`, error);
        return reject(error);
      });
    }));
  }

  return Promise.all(useCasePromises)
  .then(() => {
      this.dispatch.success('fetchUseCaseData', "Successfully fetched use case data", this.useCaseDetailsCache.getQueue());
      return this.useCaseDetailsCache.getQueue();
    })
    .catch(error => {
      this.dispatch.failed('fetchUseCaseData', "Fetch use case data failed", "fetchUseCaseDataFailed", error);
      throw new Error(error);
    });
};

SCACommunicator.prototype.buildHTML = function ({useCaseName, fields}) {
  const HTMLfields = [];

  try {
    for (let [key, {label, fieldHTML}] of Object.entries(fields)) {
      if (!fieldHTML) continue;

      const labelEle = document.createElement('label');
      labelEle.textContent = label;

      let inputEle;
      if (typeof fieldHTML === 'string') {
        const dom = (typeof DOMParser !== 'undefined') ?
          new DOMParser().parseFromString(fieldHTML, 'text/xml') :
          new window.DOMParser().parseFromString(fieldHTML, 'text/xml');
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

      
      HTMLfields.push({label: labelEle, input: inputEle});
    }
  } catch (error) {
    this.dispatch.failed('buildHTML', "Building HTML failed", "buildHTMLError", error);
    throw new Error(error);
  }
  
  this.dispatch('buildHTML.success', HTMLfields);
  this.HTMLFields = this.HTMLFields || {};
  this.HTMLFields[useCaseName] = HTMLfields;
  
  return fields;
};

SCACommunicator.prototype.sendJobRequest = function (packet) {
  this.dispatch('sendJobRequest.invoked', packet);
  

  packet = {...packet, userKey: (packet.userKey || this.options.userKey)};
  const jobKey = packet.toHash();

  if (this.jobRequestQueueHelper.exists(jobKey)) {
    const cachedJobRequest = this.jobRequestQueueHelper.get(jobKey);
    this.dispatch('sendJobRequest.cachedRequest.success', cachedJobRequest);
    return cachedJobRequest;
  };

  const reqOpt = {
    userKey: packet.userKey,
    useCaseName: packet.useCaseName,
    jobData: packet.jobData
  };
  this.logger.debug('Built request options for job request', reqOpt);

  return new Promise((resolve, reject) => {
    if (!reqOpt.jobData) {
      const errMsg = 'Missing jobData property in packet.';
      this.logger.error(errMsg);
      this.dispatch('sendJobRequest.failed', errMsg);
      return reject(errMsg);
    }

    if (!reqOpt.useCaseName) {
      const errMsg = 'Missing useCaseName property in packet';
      this.logger.error(errMsg);
      this.dispatch('sendJobRequest.failed', 'Missing ');
      return reject('Missing useCaseName property in packet.');
    }

    axios({
      method: 'POST',
      url: `${this.options.apiEndpoint}/demos/job`,
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
  if (!jobRequest || !jobID) throw new Error(`No request could be found matching the jobKey: ${jobKey}. Ensure you're not sending the jobID by mistake.`);

  let jobResponseEndPoint;
  if (this.options.jobResponseEndPoint) {
    jobResponseEndPoint = `${this.options.jobResponseEndPoint}/${jobID}${this.options.jobResponseEndPointExtras}`
  } else {
    jobResponseEndPoint = `${this.options.apiEndpoint}/demos/job/${jobID}/full`;
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

SCACommunicator.prototype.initQueueCache = function (queueKey, data, flatten = true) {
  this[queueKey] = data || this[queueKey];
  const self = this;
  
  try {
    if (!this[queueKey] && (typeof localStorage !== 'undefined') && localStorage.getItem(queueKey)) {
      this[queueKey] = JSON.parse(localStorage.getItem(queueKey));
      this.dispatch.success('initQueueCache.localStorage', 'Initializing localStorage cache was a success', this[queueKey]);
    } else {
      this[queueKey] = {};
      this.dispatch.failed('initQueueCache.localStorage', "Initializing localStorage cache failed", "localStorageCacheError", "localStorage is undefined");
    }

    this.dispatch.success('initQueueCache', 'Initializing queue cache was a success', this[queueKey]);
  } catch (error) {
    this[queueKey] = {};
    this.dispatch.failed('initQueueCache', "Initializing queue cache failed", "initQueueCacheError", error);
  }

  this.on('initQueueCache.failed', error => console.error(error));

  try {
    const cacheQueueMethods = {
      setQueue: function (data) {
        this[queueKey] = data;
        this.dispatch('initQueueCache.setQueue', {queueKey, queue: this[queueKey]});
      }.bind(this),
      getQueue: function () {
        this.dispatch('initQueueCache.getQueue', {queueKey, queue: this[queueKey]});
        return this[queueKey];
      }.bind(this),
      set: function (key, data) {
        const queue = this.getQueue();
        queue[key] = data;
        this.setQueue(queue);
        if (typeof localStorage !== 'undefined') localStorage.setItem(queueKey, JSON.stringify(queue));
        self.dispatch('initQueueCache.set', {key, data: queue[key]});
      },
      get: function (key) {
        const queue = this.getQueue();
        self.dispatch('initQueueCache.get', {key, data: queue[key]});
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
        self.dispatch('initQueueCache.add', {key, data});
      },
      delete: function (key) {
        const queue = this.getQueue();
        delete queue[key];
        this.setQueue(queue);
        self.dispatch('initQueueCache.delete', key);
      },
      exists: function (key) {
        self.dispatch('initQueueCache.exists', key);
        return !!this.getQueue()[key];
      }
    };

    return cacheQueueMethods;
  } catch (error) {
    this.dispatch.failed('initQueueCache', "Initializing queue cache failed", "initQueueCacheError", error);
    throw new Error(error);
  }
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
      this.dispatch('consolidateRequestsAndResponses.success');
      return this.jobResponseQueueHelper.getQueue();
    })
    .catch(error => {
      this.dispatch('consolidateRequestsAndResponses.failed', error);
      return error;
    });
};

SCACommunicator.prototype.getCachedJobRequestKeys = function () {
  if (!this.jobRequestQueueHelper) throw new Error('The jobRequestQueueHelper must be instantiated before this method can be invoked.');

  const jobKeys = Object.entries(this.jobRequestQueueHelper.getQueue())
    .map(([key]) => key);
  this.dispatch('getCachedJobRequestKeys.success', jobKeys);
};

SCACommunicator.prototype.clearCachedJobRequests = function () {
  this.jobRequestQueueHelper.setQueue({});
  this.dispatch('clearCachedJobRequests.success', this.jobRequestQueueHelper.getQueue());
};

SCACommunicator.prototype.clearCachedJobResponses = function () {
  this.jobResponseQueueHelper.setQueue({});
  this.dispatch('clearCachedJobResponses.success', this.jobResponseQueueHelper.getQueue());
};

SCACommunicator.prototype.initRequestAndResponseQueues = function () {
  this.jobRequestQueueHelper = this.initQueueCache('jobRequestQueue');
  this.jobResponseQueueHelper = this.initQueueCache('jobResponseQueue');
};

SCACommunicator.prototype.dispatchMessageFormat = function (dispatchCode, message, postFix = 'info') {
  message = {...message, timestamp: (new Date).getTime()};
  this.dispatch(`${dispatchCode}${postFix ? `.${postFix}` : ``}`, message);
  return message;
};

SCACommunicator.prototype.debugDispatch = function (dispatchCode, ...extras) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {...extras};
    return this.dispatchMessageFormat(dispatchCode, message, 'debug');
};

SCACommunicator.prototype.infoDispatch = function (dispatchCode, contextualMessage, extra) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {message: contextualMessage, extra}
    return this.dispatchMessageFormat(dispatchCode, message, 'info');
};

SCACommunicator.prototype.successDispatch = function (dispatchCode, contextualMessage, extra) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {message: contextualMessage, extra}
    return this.dispatchMessageFormat(dispatchCode, message, 'success');
};

SCACommunicator.prototype.failedDispatch = function (dispatchCode, contextualMessage, errorCode, errorMessage, extra) {
  if (!dispatchCode || !contextualMessage || !errorCode || !errorMessage)
    throw new Error('Dispatch code, contextual message, error code, and error message are the minimum requirements for error handling.');

  message = {timestamp: (new Date).getTime(), message: contextualMessage, errorCode, errorMessage, extra};
  return this.dispatchMessageFormat(dispatchCode, message, 'failed');
};

SCACommunicator.prototype.defaultLogger = function (loggingLevel) {
  const loggingLevels = [
    'log',
    'info',
    'error',
    'warn',
    'debug'
  ];

  loggingLevel = loggingLevel || 'info';
  const allowedLevel = loggingLevels.indexOf(loggingLevel);

  return new Proxy({}, {
    get: function (proxy, type) {
      if (!loggingLevels.includes(loggingLevel)) (...args) => console.log(...args);
      if (!(loggingLevels.indexOf(type) <= allowedLevel)) return () => undefined;
      if (loggingLevel === 'debug') return (...args) => console.dir(...args);

      return (...args) => console[type](...args);
    }
  });
};

module.exports = SCACommunicator;