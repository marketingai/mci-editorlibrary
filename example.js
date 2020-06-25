const testConfig = require('./test-config');
const MCIEditorLibrary = require('./index');

(async () => {
  // Creating new SCACommunicator instance
  const mci = new MCIEditorLibrary();
  await mci.init(testConfig);

  // Defining a package
  const examplePacket = {
    useCaseName: 'conversionImprovement',
    jobData: {
      content: `
        This colour is pure happiness after a long winter. Celebrate the return of green leaves with this gorgeous linen ring sling! Linen becomes softer and over time and never loses it’s shape, giving you years of use through multiple children. Each sling is made with your comfort in mind. Children can be heavy and the last thing you want is a sling that digs into your shoulders and neck! That’s why each sling is sewn with a comfortable, lightly padded shoulder to keep you, and your child, happy. In addition, each sling is made to accommodate ALL body types. Slings are a great way to keep your baby close and your hands free. *Some items are made to order and may not be exactly as shown. Example-Ring colours may vary Wearing your baby increases bonding by encouraging skin to skin contact and closeness with parents and caregivers. Baby slings mimic the womb environment, making baby feel safe and secure. Baby's needs are easily met when held close, which means less crying. Baby slings are great for discreet breastfeeding no matter where you are. This sling is suitable for babies between 7-35 Pounds. Be sure to exercise caution when wearing your baby. *Keep baby's face visible at all times. *Practice wearing your sling before putting baby inside. *Avoid any unsafe activities while wearing your baby, such as: Smoking, drinking hot drinks, running, exercising, cooking, or drinking alcohol.
        https://www.totheroot.ca/products/baby-carriers/230
      `
    }
  };

  const jobRequest = await mci.sendJobRequest(examplePacket);
  const jobResponse = await mci.fetchJobResponse(jobRequest.jobKey);
})();