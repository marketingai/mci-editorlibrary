const faker = require('faker');
(require('./keygen'))();


test('Converts object to reliable hash key', () => {
  const testPacket = {
    name: faker.name.findName(),
    email: faker.internet.email(),
    card: faker.helpers.createCard()
  };

  const hash = testPacket.toHash();

  expect(testPacket.toHash()).toEqual(hash);
})