module.exports = mci => {
  if (!mci) throw new Error('You are missing an instantiated SCACommunicator instance');

  const { jobLogsOnly, initLogsOnly } = ((mci.options && mci.options.loggingOptions) || {});

  if (!jobLogsOnly) {
    mci.on('initQueueCache.localStorage.success', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.localStorage.failed', that => mci.logger.error(that.message));
    mci.on('initQueueCache.success', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.failed', that => mci.logger.error(that.message));
    mci.on('initQueueCache.setQueue.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.getQueue.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.set.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.get.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.add.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.delete.info', that => mci.logger.debug(that.message));
    mci.on('initQueueCache.exists.info', that => mci.logger.debug(that.message));

    mci.on('initRequestAndResponseQueues.success', that => mci.logger.debug(that.message));
    mci.on('initRequestAndResponseQueues.failed', that => mci.logger.error(that.message));

    [
      'conversionImprovement',
      'keywordConsistency',
      'improvedVisibility',
      'technicalAudit'
    ].map(useCase => {
      mci.on(`fetchUseCaseData.${useCase}.cached.success`, that => mci.logger.debug(that.message));
      mci.on(`fetchUseCaseData.${useCase}.update.success`, that => mci.logger.debug(that.message));
      mci.on(`fetchUseCaseData.${useCase}.update.failed`, that => mci.logger.error(that.message));
      mci.on('fetchUseCaseData.success', that => mci.logger.debug(that.message));
      mci.on('fetchUseCaseData.failed', that => mci.logger.error(that.message));
    });

    mci.on('buildHTML.success', that => mci.logger.debug(that.message));
    mci.on('buildHTML.failed', that => mci.logger.error(that.message));
  }

  mci.on('init.success', that => mci.logger.debug(that.message));
  mci.on('init.failed', message => mci.logger.error(message));

  if (!initLogsOnly) {
    mci.on('consolidateRequestsAndResponses.info', that => mci.logger.debug(that.message));
    mci.on('consolidateRequestsAndResponses.success', that => mci.logger.debug(that.message));
    mci.on('consolidateRequestsAndResponses.failed', that => mci.logger.error(that.message));
    mci.on('getCachedJobRequestKeys.success', that => mci.logger.debug(that.message));
    mci.on('getCachedJobRequestKeys.failed', that => mci.logger.error(that.message));
    mci.on('clearCachedJobRequests.success', that => mci.logger.debug(that.message));
    mci.on('clearCachedJobRequests.failed', that => mci.logger.error(that.message));
    mci.on('clearCachedJobResponses.success', that => mci.logger.debug(that.message));
    mci.on('clearCachedJobResponses.failed', that => mci.logger.error(that.message));

    mci.on('sendJobRequest.invoked.info', packet => mci.logger.debug('Job request invoked'));
    mci.on('sendJobRequest.cachedRequest.success', that => mci.logger.debug(that.message));
    mci.on('sendJobRequest.success', that => mci.logger.debug(that.message));
    mci.on('sendJobRequest.failed', that => mci.logger.error(that.message));

    mci.on('fetchJobResponse.invoked.info', jobKey => mci.logger.debug('Job response invoked'));
    mci.on('fetchJobResponse.cached.success', that => mci.logger.debug(that.message));
    mci.on('fetchJobResponse.success', that => mci.logger.debug(that.message));
    mci.on('fetchJobResponse.failed', that => mci.logger.error(that.message));
  }
};