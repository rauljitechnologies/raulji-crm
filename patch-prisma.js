// patch-prisma.js — loaded via node -r ./patch-prisma server.js
// Intercepts require('../../prisma/generated/client') and redirects to @prisma/client
// Needed because prisma/generated/client is root-owned and can't be regenerated without sudo
'use strict';
const Module = require('module');
const orig   = Module._load.bind(Module);
Module._load  = function (request, parent, isMain) {
  if (typeof request === 'string' && request.includes('generated/client')) {
    return orig('@prisma/client', parent, isMain);
  }
  return orig(request, parent, isMain);
};
