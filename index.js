require('./keygen')();
const axios = require('axios');
window = (typeof window !== 'undefined' && window) || (new (require('jsdom')).JSDOM('<!DOCTYPE html>')).window;
document = window.document;
localStorage = (typeof localStorage !== 'undefined') ? localStorage : (new (require('node-localstorage')).LocalStorage('./nodeLSCache'));
const coreEventLogs = require('./coreEventLogging');

function MCIEditorLibrary () {
  this.ObserverInit();
  return this;
}

MCIEditorLibrary.prototype.ObserverInit = function () {
  this.handlers = {};

  this.on = function (type, fn) {
    if (this.options && this.options.loggingOptions && this.options.loggingOptions.onLogs)
      this.logger.debug(`Listening to ${type}`);

    if (!this.handlers[type])
      this.handlers[type] = [];

    this.handlers[type].push(fn);
  };

  this.dispatch = function (type, data) {
    if (this.options && this.options.loggingOptions && this.options.loggingOptions.dispatchLogs)
      this.logger.debug(`Dispatching ${type}`);

    if (!this.handlers || !this.handlers[type]) return;

    for (let handler of this.handlers[type]) {
      handler(data);
    }
  };

  this.dispatch.debug = this.debugDispatch.bind(this);
  this.dispatch.info = this.infoDispatch.bind(this);
  this.dispatch.success = this.successDispatch.bind(this);
  this.dispatch.failed = this.failedDispatch.bind(this);
};


MCIEditorLibrary.prototype.init = function (options) {
  return new Promise (async (resolve, reject) => {    
    this.options = options;
    this.useCaseNames = (this.options && this.options.useCaseNames) || [
      'conversionImprovement',
      'keywordConsistency',
      'improvedVisibility',
      'technicalAudit'
    ];

    this.logger = this.defaultLogger();

    try {
      if (!this.options || !this.options.userKey)
        throw new Error('Missing required argument userkey');
      if (!this.options || !this.options.apiEndpoint)
        throw new Error('Missing required argument apiEndpoint');

      this.initRequestAndResponseQueues();
      this.useCaseDetailsCache = this.initQueueCache('useCaseDetails');

      await this.fetchUseCaseData();
      this.buildHTML();
      await this.consolidateRequestsAndResponses();
      
      this.dispatch.success('init', 'MCIEditorLibrary is successfully inititialized', this);
      return resolve(this);
    } catch (error) {
      this.dispatch.failed('init', 'MCIEditorLibrary initialization failed', 'initFailed', error);
      return reject(error);
    }
  });
};

MCIEditorLibrary.prototype.fetchUseCaseData = function () {
  this.dispatch.info('fetchUseCaseData.invoked', 'Invoking fetchUseCaseData');

  const useCaseDetailsEndpoint = `${this.options.apiEndpoint}/demos/custom`;

  const useCasePromises = [];
  for (let useCase of this.useCaseNames) {
    useCasePromises.push(new Promise((resolve, reject) => {
      if (this.useCaseDetailsCache.exists(useCase)) {
        this.dispatch.success(`fetchUseCaseData.${useCase}.cached`, `Successfully fetched ${useCase} use case data cache`, this.useCaseDetailsCache.get(useCase));
        resolve(this.useCaseDetailsCache.get(useCase));
      }

      // We'll run this anyways so it updates with the new use case fields
      axios(`${useCaseDetailsEndpoint}/${useCase}`)
      .then(({data}) => {
        this.useCaseDetailsCache.set(useCase, data);
        this.dispatch.success(`fetchUseCaseData.${useCase}.update`, `Successfully updated ${useCase} use case data cache`, this.useCaseDetailsCache.get(useCase));
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

MCIEditorLibrary.prototype.buildHTML = function () {
  for (let [useCaseName, {fields}] of Object.entries(this.useCaseDetailsCache.getQueue())) {
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
    
    this.HTMLFields = this.HTMLFields || {};
    this.HTMLFields[useCaseName] = HTMLfields;
  }
  
  this.dispatch.success('buildHTML', 'Successfully built HTML fields', this.HTMLfields);
  return this.HTMLFields;
};

MCIEditorLibrary.prototype.sendJobRequest = function (packet) {
  this.dispatch.info('sendJobRequest.invoked', packet);
  

  packet = {...packet, userKey: (packet.userKey || this.options.userKey)};
  const jobKey = packet.toHash();

  if (this.jobRequestQueueHelper.exists(jobKey)) {
    const cachedJobRequest = this.jobRequestQueueHelper.get(jobKey);
    this.dispatch.success('sendJobRequest.cachedRequest', 'Cached job request found', cachedJobRequest);
    return cachedJobRequest;
  };

  const reqOpt = {
    userKey: packet.userKey,
    useCaseName: packet.useCaseName,
    jobData: packet.jobData
  };

  return new Promise((resolve, reject) => {
    if (!reqOpt.jobData) {
      const errMsg = 'Missing jobData property in packet.';
      this.dispatch.failed('sendJobRequest', 'The job request failed due to missing jobData property in packet', 'missingProperty', errMsg);
      return reject(errMsg);
    }

    if (!reqOpt.useCaseName) {
      const errMsg = 'Missing useCaseName property in packet';
      this.dispatch.failed('sendJobRequest', 'The job request failed due to missing useCaseName property in packet', 'missingProperty', errMsg);
      return reject('Missing useCaseName property in packet.');
    }

    axios({
      method: 'POST',
      url: `${this.options.apiEndpoint}/demos/job`,
      data: reqOpt
    })
    .then(({data}) => {
      dataResp = {...data, jobKey: jobKey};
      this.dispatch.success('sendJobRequest', 'Job request was sent successfully', dataResp);
      this.jobRequestQueueHelper.set(jobKey, dataResp);
      return resolve(dataResp);
    })
    .catch(error => {
      this.dispatch.failed('sendJobRequest', 'The job request failed due to error', 'error', error);
      return reject(error);
    });
  });
};

MCIEditorLibrary.prototype.fetchJobResponse = function (jobKey) {
  this.dispatch.info('fetchJobResponse.invoked', jobKey);

  const {jobID, ...jobRequest} = this.jobRequestQueueHelper.get(jobKey) || {};
  if (!jobRequest || !jobID) throw new Error(`No request could be found matching the jobKey: ${jobKey}. Ensure you're not sending the jobID by mistake.`);

  let jobResponseEndPoint = `${this.options.apiEndpoint}/demos/job/${jobID}/full`;

  return new Promise((resolve, reject) => {
    const jobCheck = setInterval(() => {
      axios(jobResponseEndPoint)
      .then(({data}) => {
        if (data.job) {
          clearInterval(jobCheck);
          const dataResp = {...data.job, jobKey}
          this.dispatch.success('fetchJobResponse', 'Job response fetched successfully', dataResp);
          return resolve(dataResp);
        }
      })
      .catch(error => {
        this.dispatch.failed('fetchJobResponse', 'There was an error fetching the job response', 'error', error);
        return reject(error);
      });
    }, 5000);
  });
};

MCIEditorLibrary.prototype.initQueueCache = function (queueKey, data, flatten = true) {
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
  } catch (error) {
    this[queueKey] = {};
    this.dispatch.failed('initQueueCache', `Initializing ${queueKey} queue cache failed`, "initQueueCacheError", error);
  }

  try {
    const cacheQueueMethods = {
      setQueue: function (data) {
        this[queueKey] = data;
        this.dispatch.info('initQueueCache.setQueue', `Setting ${queueKey} queue cache`, {queueKey, queue: this[queueKey]});
      }.bind(this),
      getQueue: function () {
        this.dispatch.info('initQueueCache.getQueue', `Getting ${queueKey} queue cache`, {queueKey, queue: this[queueKey]});
        return this[queueKey];
      }.bind(this),
      set: function (key, data) {
        const queue = this.getQueue();
        queue[key] = data;
        this.setQueue(queue);
        if (typeof localStorage !== 'undefined') localStorage.setItem(queueKey, JSON.stringify(queue));
        self.dispatch.info('initQueueCache.set', `Setting ${key} data in ${queueKey} queue cache`, {key, data: queue[key]});
      },
      get: function (key) {
        const queue = this.getQueue();
        self.dispatch.info('initQueueCache.get', `Getting ${key} data from ${queueKey} queue cache`, {key, data: queue[key]});
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
        self.dispatch.info('initQueueCache.add', `Adding to ${key} data in ${queueKey} queue cache`, {key, data});
      },
      delete: function (key) {
        const queue = this.getQueue();
        delete queue[key];
        this.setQueue(queue);
        self.dispatch.info('initQueueCache.delete', `Removing ${key} data from ${queueKey} queue cache`, key);
      },
      exists: function (key) {
        self.dispatch.info('initQueueCache.exists', `Checking existence of ${key} data in ${queueKey} queue cache`, key);
        return !!this.getQueue()[key];
      }
    };

    this.dispatch.success('initQueueCache', `Initializing ${queueKey} queue cache was successful`, this[queueKey])
    return cacheQueueMethods;
  } catch (error) {
    this.dispatch.failed('initQueueCache', `Initializing queue cache failed`, "initQueueCacheError", error);
    throw new Error(error);
  }
};

MCIEditorLibrary.prototype.consolidateRequestsAndResponses = function () {
  this.dispatch.info('consolidateRequestsAndResponses.invoked', 'Attempting to consolidate job requests and responses');
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
      this.dispatch.success('consolidateRequestsAndResponses', 'Consolidated requests and responses successfully');
      return this.jobResponseQueueHelper.getQueue();
    })
    .catch(error => {
      this.dispatch.failed('consolidateRequestsAndResponses', 'There was an error during consolidation of requests and responses', 'error', error);
      return error;
    });
};

MCIEditorLibrary.prototype.getCachedJobRequestKeys = function () {
  if (!this.jobRequestQueueHelper) {
    this.dispatch.failed('getCachedJobRequestKeys', 'There was an error getting the job request queue', 'queueMissing', 'jobRequestQueueHelper not found');
    throw new Error('The jobRequestQueueHelper must be instantiated before this method can be invoked.');
  }

  try {
    const jobKeys = Object.entries(this.jobRequestQueueHelper.getQueue())
      .map(([key]) => key);
    this.dispatch.success('getCachedJobRequestKeys', 'Cached job request keys found', jobKeys);
  } catch (error) {
    this.dispatch.failed('getCachedJobRequestKeys', 'There was an error retrieving the job request keys', 'error', error);
    throw new Error(error);
  }
};

MCIEditorLibrary.prototype.clearCachedJobRequests = function () {
  if (!this.jobRequestQueueHelper) {
    this.dispatch.failed('clearCachedJobRequests', 'There was an error getting the job request queue', 'queueMissing', 'jobRequestQueueHelper not found');
    throw new Error('The jobRequestQueueHelper must be instantiated before this method can be invoked.');
  }

  try {
    this.jobRequestQueueHelper.setQueue({});
    this.dispatch.success('clearCachedJobRequests', 'Cached job request keys were cleared', jobKeys);
  } catch (error) {
    this.dispatch.failed('clearCachedJobRequests', 'There was an error clearing the job request keys', 'error', error);
    throw new Error(error);
  }
};

MCIEditorLibrary.prototype.initRequestAndResponseQueues = function () {
  try {
    this.jobRequestQueueHelper = this.initQueueCache('jobRequestQueue');
    this.jobResponseQueueHelper = this.initQueueCache('jobResponseQueue');
    this.dispatch.success('initRequestAndResponseQueues', 'The job request and response queues were initialized successfully');
  } catch (error) {
    this.dispatch.failed('initRequestAndResponseQueues', 'There was an error initializing the job request and response queues', 'error', error);
    throw new Error(error);
  }
};

MCIEditorLibrary.prototype.dispatchMessageFormat = function (dispatchCode, message, postFix = 'info') {
  message = {...message, timestamp: (new Date).getTime()};
  this.dispatch(`${dispatchCode}${postFix ? `.${postFix}` : ``}`, message);
  return message;
};

MCIEditorLibrary.prototype.debugDispatch = function (dispatchCode, ...extras) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {...extras};
    return this.dispatchMessageFormat(dispatchCode, message, 'debug');
};

MCIEditorLibrary.prototype.infoDispatch = function (dispatchCode, contextualMessage, extra) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {message: contextualMessage, extra}
    return this.dispatchMessageFormat(dispatchCode, message, 'info');
};

MCIEditorLibrary.prototype.successDispatch = function (dispatchCode, contextualMessage, extra) {
  if (!dispatchCode)
    throw new Error('Dispatch code is a mandatory requirement for success handling');

    const message = {message: contextualMessage, extra}
    return this.dispatchMessageFormat(dispatchCode, message, 'success');
};

MCIEditorLibrary.prototype.failedDispatch = function (dispatchCode, contextualMessage, errorCode, errorMessage, extra) {
  if (!dispatchCode || !contextualMessage || !errorCode || !errorMessage)
    throw new Error('Dispatch code, contextual message, error code, and error message are the minimum requirements for error handling.');

  message = {timestamp: (new Date).getTime(), message: contextualMessage, errorCode, errorMessage, extra};
  return this.dispatchMessageFormat(dispatchCode, message, 'failed');
};

MCIEditorLibrary.prototype.defaultLogger = function () {
  if (!this.options || !this.options.loggingOptions || !this.options.loggingOptions.loggingEnabled) {
    return new Proxy({}, {
      get: function (_, type) {
        return () => {};
      }
    })
  }

  if (this.options.loggingOptions.coreEventLogsEnabled) coreEventLogs(this);
  const loggingLevel = this.options.loggingOptions.loggingLevel || 'info';

  let loggingLevels = [
    'log',
    'info',
    'error',
    'warn',
    'debug'
  ];

  const { only } = ((this.options && this.options.loggingOptions) || {});
  if (only) {
    loggingLevels = only;
  }

  loggingLevel = loggingLevel || 'info';
  const allowedLevel = loggingLevels.indexOf(loggingLevel);

  return new Proxy({}, {
    get: function (_, type) {
      if (!loggingLevels.includes(loggingLevel) && !only) {
        (...args) => console.log(...args);
      }
      
      if (!(loggingLevels.indexOf(type) <= allowedLevel && loggingLevels.indexOf(type) >= 0)) {
        return () => undefined;
      }
      
      return (...args) => console[type](...args);
    }
  });
};

module.exports = MCIEditorLibrary;