
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.CompanyScalarFieldEnum = {
  companyId: 'companyId',
  name: 'name',
  slug: 'slug',
  domain: 'domain',
  logo: 'logo',
  gst: 'gst',
  industry: 'industry',
  phone: 'phone',
  email: 'email',
  website: 'website',
  plan: 'plan',
  status: 'status',
  apiKey: 'apiKey',
  apiSecret: 'apiSecret',
  address: 'address',
  bankDetails: 'bankDetails',
  settings: 'settings',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  userId: 'userId',
  name: 'name',
  email: 'email',
  phone: 'phone',
  password: 'password',
  role: 'role',
  permissions: 'permissions',
  avatar: 'avatar',
  companyId: 'companyId',
  isActive: 'isActive',
  isVerified: 'isVerified',
  inviteToken: 'inviteToken',
  inviteExpiry: 'inviteExpiry',
  lastLogin: 'lastLogin',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  token: 'token',
  userId: 'userId',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.LeadScalarFieldEnum = {
  leadId: 'leadId',
  companyId: 'companyId',
  name: 'name',
  email: 'email',
  phone: 'phone',
  city: 'city',
  state: 'state',
  source: 'source',
  status: 'status',
  priority: 'priority',
  dealValue: 'dealValue',
  currency: 'currency',
  aiScore: 'aiScore',
  aiScoreFactors: 'aiScoreFactors',
  assignedToId: 'assignedToId',
  tags: 'tags',
  notes: 'notes',
  customFields: 'customFields',
  lastActivityAt: 'lastActivityAt',
  nextFollowUpAt: 'nextFollowUpAt',
  isDeleted: 'isDeleted',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ActivityScalarFieldEnum = {
  activityId: 'activityId',
  companyId: 'companyId',
  leadId: 'leadId',
  userId: 'userId',
  type: 'type',
  description: 'description',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.DealScalarFieldEnum = {
  dealId: 'dealId',
  companyId: 'companyId',
  leadId: 'leadId',
  name: 'name',
  value: 'value',
  currency: 'currency',
  stage: 'stage',
  probability: 'probability',
  expectedCloseDate: 'expectedCloseDate',
  closedAt: 'closedAt',
  lostReason: 'lostReason',
  assignedToId: 'assignedToId',
  tags: 'tags',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuotationScalarFieldEnum = {
  quotationId: 'quotationId',
  quotationNumber: 'quotationNumber',
  companyId: 'companyId',
  leadId: 'leadId',
  dealId: 'dealId',
  clientName: 'clientName',
  clientEmail: 'clientEmail',
  clientPhone: 'clientPhone',
  clientAddress: 'clientAddress',
  clientGst: 'clientGst',
  validUntil: 'validUntil',
  currency: 'currency',
  items: 'items',
  subtotal: 'subtotal',
  totalGst: 'totalGst',
  totalDiscount: 'totalDiscount',
  grandTotal: 'grandTotal',
  status: 'status',
  notes: 'notes',
  termsConditions: 'termsConditions',
  pdfUrl: 'pdfUrl',
  sentAt: 'sentAt',
  convertedToInvoiceId: 'convertedToInvoiceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  invoiceId: 'invoiceId',
  invoiceNumber: 'invoiceNumber',
  companyId: 'companyId',
  leadId: 'leadId',
  quotationId: 'quotationId',
  clientName: 'clientName',
  clientEmail: 'clientEmail',
  clientPhone: 'clientPhone',
  clientAddress: 'clientAddress',
  clientGst: 'clientGst',
  dueDate: 'dueDate',
  currency: 'currency',
  items: 'items',
  subtotal: 'subtotal',
  totalGst: 'totalGst',
  totalDiscount: 'totalDiscount',
  grandTotal: 'grandTotal',
  paidAmount: 'paidAmount',
  status: 'status',
  paymentTerms: 'paymentTerms',
  bankDetails: 'bankDetails',
  paymentLink: 'paymentLink',
  pdfUrl: 'pdfUrl',
  paidAt: 'paidAt',
  paymentMethod: 'paymentMethod',
  transactionId: 'transactionId',
  notes: 'notes',
  sentAt: 'sentAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClientScalarFieldEnum = {
  clientId: 'clientId',
  companyId: 'companyId',
  name: 'name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  gst: 'gst',
  pan: 'pan',
  notes: 'notes',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WebhookScalarFieldEnum = {
  webhookId: 'webhookId',
  companyId: 'companyId',
  url: 'url',
  events: 'events',
  secret: 'secret',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.Plan = exports.$Enums.Plan = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  ENTERPRISE: 'ENTERPRISE'
};

exports.Role = exports.$Enums.Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SALES_MANAGER: 'SALES_MANAGER',
  SALES_REP: 'SALES_REP',
  VIEWER: 'VIEWER'
};

exports.Prisma.ModelName = {
  Company: 'Company',
  User: 'User',
  RefreshToken: 'RefreshToken',
  Lead: 'Lead',
  Activity: 'Activity',
  Deal: 'Deal',
  Quotation: 'Quotation',
  Invoice: 'Invoice',
  Client: 'Client',
  Webhook: 'Webhook'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
