// Central Prisma client — uses locally generated client so all models are available
const { PrismaClient } = require('../../prisma/generated/client');
const prisma = new PrismaClient();
module.exports = prisma;
