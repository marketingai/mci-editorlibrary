# MCI Editor Library

## Description:
> This library will allow you to make job requests with the MCI API as well as receive job responses. The goal of this library is to provide a robust library that can be integrated with any application, editor, or plugin. It is client-side/server-side agnostic increasing its flexibility. The observer integration provides several logical hooks for tapping into the various life cycle events that occur from instantiation to a job response. In addition, there is a built in caching system to improve response speed for retrieving use cases and previous job request and job response data.

## Dependencies:
> The library relies on a few dependencies such as **Axios**, **JSDOM**, and **Node LocalStorage**. *JSDOM* provides a DOM structure on the server and **Node LocalStorage** provides a caching solution that mimics client-side LocalStorage. Axios is used for the API communication.

## Requirements:
> You will need your **user key** provided to you by the MCI sales team as well as the **API endpoint** to communicate with. 

## Simple use of the MCI Library:

### Installing
```bash
npm install "git+https://github.com/marketingai/mci-editorlibrary.git"
```

### Instantiate a new MCI EditorLibrary instance
```javascript
const MCIEditorLibrary = require('MCIEditorLibrary');
const mci = new MCIEditorLibrary({
  userKey: 'youruserkey.providedtoyou',
  apiEndpoint: 'https://mci.example-endpoint.com/api'
});
```

### Provide a job request packet
```javascript
const examplePacket = {
  useCaseName: 'conversionImprovement',
  jobData: {
    content: `
      The example domain is great for examples!
      http://example.com
    `
  }
};

const jobRequest = await mci.sendJobRequest(examplePacket);
```

### Get a job response
```javascript
const jobResponse = await mci.fetchJobResponse(jobRequest.jobKey);
```

---
---
<br/>
<br/>

# Advance Features of the MCI Library:

## Hook Events
> Hook events allow you to tap into the various lifecycle moments in the MCI. You can perform operations during or after instantiation, before or after a job request, and before or after a job response. You can also register your own hooks if you choose to.

### **Hook registration example**
```javascript
mci.on('hook.event', data => {
  // your code
});
```

### **Available hooks for registration** (during initialization life cycle)
<p><small><em>In the order the life cycle events are dispatched</em></small></p>
<table>
  <thead>
    <tr>
      <th>Hook Event</th>
      <th>Moment</th>
      <th>Message</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>initRequestAndResponseQueues.success</td>
      <td>Before initialization and after the job request and job response queues are created</td>
      <td>{:message}</td>
    </tr>
    <tr>
      <td>initRequestAndResponseQueues.failed</td>
      <td>Before initialization and after the job request or job response queues have failed</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>initQueueCache.localStorage.success</td>
      <td>Before a queue cache is instantiated and after local storage is checked for an existing queue cache</td>
      <td>
        {:message, extra: {...queueCache}}
      </td>
    </tr>
    <tr>
      <td>initQueueCache.localStorage.failed</td>
      <td>Before a queue cache is instantiated and after local storage fails to initialize</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>initQueueCache.success</td>
      <td>After a queue cache is instantiated</td>
      <td>
        {:message, extra: {...queueCache}}
      </td>
    </tr>
    <tr>
      <td>initQueueCache.failed</td>
      <td>After a queue cache fails to instantiate</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.info</td>
      <td>Before the use case data is fetched and after the fetchUseCaseData is invoked</td>
      <td>
        {:message}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.[useCase].cached.success</td>
      <td>After the specific use case data is found in the useCaseDetailsCache queue cache</td>
      <td>
        {:message, extra: {...useCaseDetailsCache[useCase]}}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.[useCase].update.success</td>
      <td>After the specific use case data is retrieved from the API endpoint and registered to the useCaseDetailsCache queue cache</td>
      <td>
        {:message, extra: {...useCaseDetailsCache[useCase]}}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.[useCase].update.failed</td>
      <td>After the specific use case data is requested from the API endpoint and fails</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.success</td>
      <td>After all the data for all use cases is collected and stored successfully</td>
      <td>
        {:message, extra: {...useCaseDetailsCache[useCase]}}
      </td>
    </tr>
    <tr>
      <td>fetchUseCaseData.failed</td>
      <td>After any failures during use case collection and storage</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>consolidateRequestsAndResponses.invoked.info</td>
      <td>After consolidateRequestAndResponses is invoked and before checking for existing requests and responses</td>
      <td>
        {:message}
      </td>
    <tr>
      <td>consolidateRequestsAndResponses.success</td>
      <td>After requests and responses have been consolidated</td>
      <td>
        {:message}
      </td>
    </tr>
    <tr>
      <td>consolidateRequestsAndResponses.failed</td>
      <td>After any failures during the consolidation of requests and responses</td>
      <td>
        {:message, :errorCode, :error}
      </td>
    </tr>
    <tr>
      <td>init.success</td>
      <td>After successful initialization</td>
      <td>{:message, extra: {...mci instance}</td>
    </tr>
    <tr>
      <td>init.failed</td>
      <td>After failing initialization</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
  </tbody>
</table>

<br/>
<br/>

### **Available hooks for registration** (during job request/response life cycle)
<p><small><em>In the order the life cycle events are dispatched</em></small></p>
<table>
  <thead>
    <tr>
      <th>Hook Event</th>
      <th>Moment</th>
      <th>Message</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>sendJobRequest.invoked.info</td>
      <td>After sendJobRequest is invoked and before packet validation</td>
      <td>{:message, extra: {...packet}}</td>
    </tr>
    <tr>
      <td>sendJobRequest.cachedRequest.success</td>
      <td>After cached job request has been found (matching the passed packet)</td>
      <td>{:message, extra: {...cachedJobRequest}}</td>
    </tr>
    <tr>
      <td>sendJobRequest.success</td>
      <td>After job request has successfully been responded to by the API endpoint</td>
      <td>{:message, extra: {...api endpoint response data}}</td>
    </tr>
    <tr>
      <td>sendJobRequest.failed</td>
      <td>After missing data propery error OR after API endpoint request has failed</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
    <tr>
      <td>fetchJobResponse.invoked.info</td>
      <td>After fetchJobResponse is invoked and before jobKey validation</td>
      <td>{:message, extra: {jobKey}}</td>
    </tr>
    <tr>
      <td>fetchJobResponse.cachedRequest.success</td>
      <td>After cached job request has been found (matching the passed packet)</td>
      <td>{:message, extra: {...cachedJobResponse}}</td>
    </tr>
    <tr>
      <td>fetchJobResponse.success</td>
      <td>After job response request has successfully been responded to by the API endpoint</td>
      <td>{:message, extra: {...api endpoint response data}}</td>
    </tr>
    <tr>
      <td>fetchJobResponse.failed</td>
      <td>After missing data propery error OR after API endpoint request has failed</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
  </tbody>
</table>

<br/>
<br/>

### **Alternative hooks for registration**
<table>
  <thead>
    <tr>
      <th>Hook Event</th>
      <th>Moment</th>
      <th>Message</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>getCachedJobRequestKeys.success</td>
      <td>After cached job request keys are found</td>
      <td>{:message, extra: {...jobKeys}}</td>
    </tr>
    <tr>
      <td>getCachedJobRequestKeys.failed</td>
      <td>After validation error OR error in retrieving the job request keys</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
    <tr>
      <td>clearCachedJobRequests.success</td>
      <td>After cached job requests are cleared from the job request queue</td>
      <td>{:message, extra: {...jobKeys}}</td>
    </tr>
    <tr>
      <td>clearCachedJobRequests.failed</td>
      <td>After validation error OR error in clearing the cached job requests</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
    <tr>
      <td>clearCachedJobResponses.success</td>
      <td>After cached job responses are cleared from the job response queue</td>
      <td>{:message, extra: {...jobResponseQueue}}</td>
    </tr>
    <tr>
      <td>clearCachedJobResponses.failed</td>
      <td>After validation error OR error in clearing cached job responses</td>
      <td>{:message, :errorCode, :error}</td>
    </tr>
  </tbody>
</table>

<br/>
<br/>

### **Manually dispatching events**
```javascript
mci.dispatch('hook.event', data);
```

<br/>
<br/>

### **Custom observables**
> You can utilize the MCI Editor Library observable utility for your own custom hook events. Simply register the hook event:
```javascript
// Register hook event
mci.on('my.custom.hook.event', (dataIPassInTheDispatch) => {
  // custom callback operation
});

// Dispatch hook event
mci.dispatch('my.custom.hook.event', {key: 'Data I want to pass to the dispatch'});
```

---
<br/>
<br/>

## MCI Logging
> MCI Editor Library supports defined level logging. You can view predefined core logs or define your own. You can restrict which logs are visible by setting a priority, or choosing specific log types to view.

<br/>
<br/>

### **Log leves**
> There are 5 log levels (listed in order of priority)
* log
* info
* error
* warn
* debug

<br/>
<br/>

### **Setting up logging**
> **NOTE:** Passing the **only: []** option will override which logs are visible. However, your **loggingLevel** property will restrict the visibility of a log. For example, if you pass **only: ['error']** but set the **loggingLevel: 'info'** you won't see any error logs because the level is too restrictive.

```javascript
const MCIEditorLibrary = require('MCIEditorLibrary');
const mci = new MCIEditorLibrary({
  userKey: 'youruserkey.providedtoyou',
  apiEndpoint: 'https://mci.example-endpoint.com/api',
  loggingOptions: {
    loggingEnabled: true, // Logging will not work unless it's enabled
    loggingLevel: 'debug', // Default is 'info'
    only: ['error', 'debug'], // Define which log types you want to view
    jobLogsOnly: false, // View only job level logs (for core event logs only)
    initLogsOnly: false, // View only init level logs (for core event logs only)
    onLogs: false, // View your registered hook events upon registration
    dispatchLogs: false, // View when a registered hook is dispatched
    coreEventLoggingEnabled: true, // Enable core event logging
  }
});
```

---
---
<br/>
<br/>

# MCI Editor Library API Methods:

## Job Request and Job Response Methods

<br/>
<br/>

---

### .sendJobRequest({...packet})
> Sends a job request to the API endpoint

#### Example:
```javascript
mci.sendJobRequest({
  useCaseName: 'keywordPriority',
  jobData: {
    targetedKeywords: ['foo', 'bar'],
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
  }
});
```

|Option|Value|Optional|
|------|-----|--------|
|userKey|You provided user.key|yes (provided at instantiation)|
|useCaseName|Use case name from the list of available use cases|no|
|jobData|An object containing the required fields and values for the selected use case|no|

<br/>
<br/>

---

### .fetchJobResponse(jobKey)
> Requests the job response based on the passed job key

> **NOTE:** &nbsp;*Make sure you send the jobKey and not the jobId. MCI Editor Library indexes the job request and responses caches using the jobKey. The jobId can't be identified till later in the life cycle and therefore isn't a reliable index to use for storage.*

#### Example:
```javascript
mci.sendJobRequest({
  useCaseName: 'keywordPriority',
  jobData: {
    targetedKeywords: ['foo', 'bar'],
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
  }
});
```

|Option|Value|Optional|
|------|-----|--------|
|jobKey|The job key (can be found in the job request response body)|yes|
---