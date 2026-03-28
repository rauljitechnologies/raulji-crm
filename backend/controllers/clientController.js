// backend/controllers/clientController.js
'use strict';
const prisma = require('../lib/prisma');

// ── LIST ──────────────────────────────────────────────────────
exports.getClients = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { search, page = 1, limit = 100 } = req.query;
    const where = {
      companyId,
      isActive: true,
      ...(search && { OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { gst:   { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]})
    };
    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * +limit, take: +limit }),
      prisma.client.count({ where }),
    ]);
    return res.json({ success: true, data: { clients, pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) } } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── GET ONE ───────────────────────────────────────────────────
exports.getClient = async (req, res) => {
  try {
    const c = await prisma.client.findFirst({ where: { clientId: req.params.id, companyId: req.params.companyId, isActive: true } });
    if (!c) return res.status(404).json({ success: false, error: { message: 'Client not found.' } });
    return res.json({ success: true, data: c });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── CREATE ────────────────────────────────────────────────────
exports.createClient = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, email, phone, address, city, state, pincode, gst, pan, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Client name required.' } });
    const c = await prisma.client.create({
      data: {
        companyId,
        name,
        email:   email   || null,
        phone:   phone   || null,
        address: address || null,
        city:    city    || null,
        state:   state   || null,
        pincode: pincode || null,
        gst:     gst     || null,
        pan:     pan     || null,
        notes:   notes   || null,
      }
    });
    return res.status(201).json({ success: true, data: c });
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('email')) return res.status(409).json({ success: false, error: { message: 'Client with this email already exists.' } });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ── UPDATE ────────────────────────────────────────────────────
exports.updateClient = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const { name, email, phone, address, city, state, pincode, gst, pan, notes } = req.body;
    const data = {};
    if (name    !== undefined) data.name    = name;
    if (email   !== undefined) data.email   = email   || null;
    if (phone   !== undefined) data.phone   = phone   || null;
    if (address !== undefined) data.address = address || null;
    if (city    !== undefined) data.city    = city    || null;
    if (state   !== undefined) data.state   = state   || null;
    if (pincode !== undefined) data.pincode = pincode || null;
    if (gst     !== undefined) data.gst     = gst     || null;
    if (pan     !== undefined) data.pan     = pan     || null;
    if (notes   !== undefined) data.notes   = notes   || null;
    await prisma.client.updateMany({ where: { clientId: id, companyId }, data });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DELETE (soft) ─────────────────────────────────────────────
exports.removeClient = async (req, res) => {
  try {
    await prisma.client.updateMany({ where: { clientId: req.params.id, companyId: req.params.companyId }, data: { isActive: false } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
