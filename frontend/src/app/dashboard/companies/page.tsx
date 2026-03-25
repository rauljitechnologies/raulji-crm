'use client';
import { useEffect, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, Input, Sel, Modal, useToast } from '@/components/ui';

const emptyForm = () => ({
  name: '',
  brandName: '',
  logo: '',
  domain: '',
  website: '',
  gst: '',
  industry: 'technology',
  plan: 'STARTER',
  contactPerson: '',
  mobileNumber: '',
  email: '',
  otherInformation: '',
  address: {
    street: '',
    area: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
  },
});

const INDUSTRIES = [
  { value:'technology', label:'Technology' },
  { value:'real_estate', label:'Real Estate' },
  { value:'retail', label:'Retail' },
  { value:'healthcare', label:'Healthcare' },
  { value:'consulting', label:'Consulting' },
  { value:'digital_marketing', label:'Digital Marketing' },
];

const PLANS = [
  { value:'STARTER', label:'Starter — ₹999/mo' },
  { value:'GROWTH', label:'Growth — ₹2,499/mo' },
  { value:'ENTERPRISE', label:'Enterprise — ₹4,999/mo' },
];

const compact = (value?: string | null) => value?.trim() || '';
const join = (...parts: Array<string | undefined>) => parts.map(p => compact(p)).filter(Boolean).join(', ');

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const { toast, ToastContainer } = useToast();

  const load = async () => {
    try {
      const d = await companyApi.list({ limit: '50' });
      setCompanies(d.companies || []);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (co: any) => {
    setEditingId(co.companyId);
    setForm({
      name: co.name || '',
      brandName: co.settings?.brandName || '',
      logo: co.logo || '',
      domain: co.domain || '',
      website: co.settings?.website || '',
      gst: co.gst || '',
      industry: co.industry || 'technology',
      plan: co.plan || 'STARTER',
      contactPerson: co.settings?.contactPerson || '',
      mobileNumber: co.settings?.mobileNumber || '',
      email: co.settings?.email || '',
      otherInformation: co.settings?.otherInformation || '',
      address: {
        street: co.address?.street || '',
        area: co.address?.area || '',
        city: co.address?.city || '',
        state: co.address?.state || '',
        country: co.address?.country || '',
        pincode: co.address?.pincode || '',
      },
    });
    setShowModal(true);
  };

  const setAddressField = (key: string, value: string) => {
    setForm(f => ({ ...f, address: { ...f.address, [key]: value } }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Company name required', 'err');
    setSaving(true);
    try {
      if (editingId) {
        await companyApi.update(editingId, form);
        toast('Company details updated!');
      } else {
        await companyApi.create(form);
        toast('Company created!');
      }
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm());
      load();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const title = editingId ? 'Edit Company Details' : 'New Company';

  return (
    <>
      <Topbar title="Companies" subtitle={`${companies.length} companies`} actions={<Btn variant="primary" size="sm" onClick={openCreate}>+ New Company</Btn>} />
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {companies.map((co: any) => {
              const initials = co.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
              const address = join(co.address?.street, co.address?.area, co.address?.city, co.address?.state, co.address?.country, co.address?.pincode);
              const contactEmail = compact(co.settings?.email);
              const contactPhone = compact(co.settings?.mobileNumber);
              const brandName = compact(co.settings?.brandName);
              return (
                <Card key={co.companyId} className="hover:border-indigo-300 transition-colors">
                  <div className="flex items-start gap-3 mb-4">
                    {co.logo ? (
                      <img src={co.logo} alt={co.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0 bg-sky-100 text-sky-700">{initials}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-slate-900 text-base truncate">{co.name}</div>
                        <Badge status={co.status?.toLowerCase()} label={co.status} />
                      </div>
                      {brandName && <div className="text-xs text-slate-500 mt-1">Brand: {brandName}</div>}
                      <div className="flex gap-1 flex-wrap mt-2">
                        {[`${co._count?.leads||0} leads`, `${co._count?.users||0} users`, co.plan, co.industry || ''].filter(Boolean).map(t => (
                          <span key={t} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-700 mb-2">Business Details</div>
                      <div className="text-slate-500 space-y-1">
                        <div>GST: {co.gst || 'Not added'}</div>
                        <div>Website: {co.settings?.website || co.domain || 'Not added'}</div>
                        <div>Email: {contactEmail || 'Not added'}</div>
                        <div>Mobile: {contactPhone || 'Not added'}</div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-700 mb-2">Address</div>
                      <div className="text-slate-500 leading-5 min-h-[60px]">
                        {address || 'No address added yet'}
                      </div>
                    </div>
                  </div>

                  {co.settings?.otherInformation && (
                    <div className="text-xs text-slate-500 rounded-xl border border-slate-100 bg-white p-3 mb-4">
                      <span className="font-semibold text-slate-700">Other Information:</span> {co.settings.otherInformation}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Btn variant="secondary" size="sm">View Leads</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => openEdit(co)}>Edit Details</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={title}
        size="lg"
        footer={<><Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={save}>{editingId ? 'Save Changes' : 'Create Company'}</Btn></>}
      >
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-xs font-bold text-slate-900 mb-3">Company Identity</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Company Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Raulji Technologies Pvt Ltd" />
              <Input label="Brand Name" value={form.brandName} onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))} placeholder="Raulji CRM" />
              <Input label="Logo URL" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))} placeholder="https://example.com/logo.png" />
              <Input label="Website / Domain" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="raulji.com" />
              <Input label="Public Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://raulji.com" />
              <Input label="GST Number" value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} placeholder="27AAAA0000A1Z5" />
              <Sel label="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} options={INDUSTRIES} />
              <Sel label="Plan" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} options={PLANS} />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-900 mb-3">Contact Details</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Contact Person" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Ariya Raulji" />
              <Input label="Mobile Number" value={form.mobileNumber} onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value }))} placeholder="+91 98765 43210" />
              <Input label="Email ID" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="hello@raulji.com" />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-900 mb-3">Address</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Street Address" value={form.address.street} onChange={e => setAddressField('street', e.target.value)} placeholder="Office 402, Business Hub" />
              <Input label="Area / Landmark" value={form.address.area} onChange={e => setAddressField('area', e.target.value)} placeholder="Near Alkapuri Circle" />
              <Input label="City" value={form.address.city} onChange={e => setAddressField('city', e.target.value)} placeholder="Vadodara" />
              <Input label="State" value={form.address.state} onChange={e => setAddressField('state', e.target.value)} placeholder="Gujarat" />
              <Input label="Country" value={form.address.country} onChange={e => setAddressField('country', e.target.value)} placeholder="India" />
              <Input label="Pincode" value={form.address.pincode} onChange={e => setAddressField('pincode', e.target.value)} placeholder="390007" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Other Information</label>
            <textarea
              value={form.otherInformation}
              onChange={e => setForm(f => ({ ...f, otherInformation: e.target.value }))}
              placeholder="Add any extra company information, support notes, registration details, or billing instructions."
              className="w-full min-h-28 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 transition-colors focus:border-indigo-500"
            />
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
