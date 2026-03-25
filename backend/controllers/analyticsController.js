// ── analyticsController.js ────────────────────────────────────
exports.getOverview = async (req,res) => {
  try {
    const { companyId } = req.params;
    const [totalLeads, totalDeals, wonDeals, revenue, leadsBySource, leadsByStatus] = await Promise.all([
      prisma.lead.count({where:{companyId,isDeleted:false}}),
      prisma.deal.count({where:{companyId}}),
      prisma.deal.count({where:{companyId,stage:'WON'}}),
      prisma.invoice.aggregate({where:{companyId,status:'PAID'},_sum:{grandTotal:true}}),
      prisma.lead.groupBy({by:['source'],where:{companyId,isDeleted:false},_count:{source:true}}),
      prisma.lead.groupBy({by:['status'],where:{companyId,isDeleted:false},_count:{status:true}})
    ]);
    return res.json({ success:true, data:{
      summary:{ totalLeads, totalDeals, wonDeals, totalRevenue:revenue._sum.grandTotal||0, conversionRate:totalLeads>0?Math.round(wonDeals/totalLeads*1000)/10:0 },
      leadsBySource:Object.fromEntries(leadsBySource.map(s=>[s.source.toLowerCase(),s._count.source])),
      leadsByStatus:Object.fromEntries(leadsByStatus.map(s=>[s.status.toLowerCase(),s._count.status]))
    }});
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};
exports.getLeadAnalytics = async (req,res) => {
  try {
    const { companyId } = req.params;
    const bySource = await prisma.lead.groupBy({by:['source'],where:{companyId,isDeleted:false},_count:{source:true},_avg:{aiScore:true}});
    return res.json({ success:true,data:{bySource} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};
exports.getRevenue = async (req,res) => {
  try {
    const { companyId } = req.params;
    const byStatus = await prisma.invoice.groupBy({by:['status'],where:{companyId},_count:{status:true},_sum:{grandTotal:true}});
    return res.json({ success:true,data:{byStatus} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};
exports.getTeam = async (req,res) => {
  try {
    const { companyId } = req.params;
    const users = await prisma.user.findMany({where:{companyId,isActive:true},select:{userId:true,name:true,role:true,avatar:true}});
    const team = await Promise.all(users.map(async u => {
      const [leads,won] = await Promise.all([prisma.lead.count({where:{companyId,assignedToId:u.userId,isDeleted:false}}),prisma.deal.count({where:{companyId,assignedToId:u.userId,stage:'WON'}})]);
      return {...u,leadsAssigned:leads,dealsWon:won};
    }));
    return res.json({ success:true,data:{team} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};
exports.getPipeline = async (req,res) => {
  try {
    const pipeline = await prisma.deal.groupBy({by:['stage'],where:{companyId:req.params.companyId},_count:{stage:true},_sum:{value:true}});
    return res.json({ success:true,data:{pipeline} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};
