process.env.NODE_ENV = "node-test"; // required to run in Node env

const testConfig = require('./test-config');
const MCIEditorLibrary = require('./index');

(async () => {

  // Creating new SCACommunicator instance
  const mci = new MCIEditorLibrary();
  await mci.init(testConfig);

  const jobs = await mci.fetchAllCompletedJobDataByUserkey(testConfig.userKey);
  console.log(jobs);

})();