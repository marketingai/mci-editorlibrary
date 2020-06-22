const SCACommunicator = require(".");

module.exports = sca => {
  if (!sca) throw new Error('You are missing an instantiated SCACommunicator instance');

  sca.on('init.success', () => sca.logger.info('SCACommunicator successfully initialized.'));
  sca.on('init.failed', message => sca.logger.error(message));
};