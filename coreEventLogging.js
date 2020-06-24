const SCACommunicator = require(".");

module.exports = sca => {
  if (!sca) throw new Error('You are missing an instantiated SCACommunicator instance');

  const { jobLogsOnly, initLogsOnly } = ((sca.options && sca.options.loggingOptions) || {});

  if (!jobLogsOnly) {
    sca.on('init.failed', message => sca.logger.error(message));
    sca.on('init.success', that => sca.logger.debug(that.message));

    sca.on('initQueueCache.localStorage.success', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.localStorage.failed', that => sca.logger.error(that.message));
    sca.on('initQueueCache.success', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.failed', that => sca.logger.error(that.message));
    sca.on('initQueueCache.setQueue.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.getQueue.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.set.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.get.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.add.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.delete.info', that => sca.logger.debug(that.message));
    sca.on('initQueueCache.exists.info', that => sca.logger.debug(that.message));

    sca.on('initRequestAndResponseQueues.success', that => sca.logger.debug(that.message));
    sca.on('initRequestAndResponseQueues.failed', that => sca.logger.error(that.message));

    [
      'conversionImprovement',
      'keywordConsistency',
      'improvedVisibility',
      'technicalAudit'
    ].map(useCase => {
      sca.on(`fetchUseCaseData.${useCase}.cached.success`, that => sca.logger.debug(that.message));
      sca.on(`fetchUseCaseData.${useCase}.update.success`, that => sca.logger.debug(that.message));
      sca.on(`fetchUseCaseData.${useCase}.update.failed`, that => sca.logger.error(that.message));
      sca.on('fetchUseCaseData.success', that => sca.logger.debug(that.message));
      sca.on('fetchUseCaseData.failed', that => sca.logger.error(that.message));
    });

    sca.on('buildHTML.success', that => sca.logger.debug(that.message));
    sca.on('buildHTML.failed', that => sca.logger.error(that.message));
  }

  if (!initLogsOnly) {
    sca.on('consolidateRequestsAndResponses.info', that => sca.logger.debug(that.message));
    sca.on('consolidateRequestsAndResponses.success', that => sca.logger.debug(that.message));
    sca.on('consolidateRequestsAndResponses.failed', that => sca.logger.error(that.message));
    sca.on('getCachedJobRequestKeys.success', that => sca.logger.debug(that.message));
    sca.on('getCachedJobRequestKeys.failed', that => sca.logger.error(that.message));
    sca.on('clearCachedJobRequests.success', that => sca.logger.debug(that.message));
    sca.on('clearCachedJobRequests.failed', that => sca.logger.error(that.message));
    sca.on('clearCachedJobResponses.success', that => sca.logger.debug(that.message));
    sca.on('clearCachedJobResponses.failed', that => sca.logger.error(that.message));

    sca.on('sendJobRequest.invoked', packet => sca.logger.debug('Job request invoked'));
    sca.on('sendJobRequest.cachedRequest', that => sca.logger.debug(that.message));
    sca.on('sendJobRequest.success', that => sca.logger.debug(that.message));
    sca.on('sendJobRequest.failed', that => sca.logger.error(that.message));

    sca.on('fetchJobResponse.cached.success', that => sca.logger.debug(that.message));
    sca.on('fetchJobResponse.success', that => sca.logger.debug(that.message));
    sca.on('fetchJobResponse.failed', that => sca.logger.error(that.message));
  }
};